const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function loadPage(relativePath, request, storage = {}) {
  let definition
  const calls = []
  const sandbox = {
    Page(value) { definition = value },
    require() { return { request(url, method) { calls.push(url); return request(url, method) } } },
    wx: {
      getStorageSync: key => storage[key],
      setStorageSync: (key, value) => { storage[key] = value },
      navigateTo() {}, showToast() {}
    },
    console
  }
  const filename = path.join(__dirname, '..', relativePath)
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename })
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)), snapshots: [] }
  page.setData = function (update) {
    Object.assign(this.data, update)
    this.snapshots.push(JSON.parse(JSON.stringify(this.data)))
  }
  return { page, calls }
}

// Evaluate only WXML text, conditions and loops from the actual page template.
// This checks visible-state contracts; it is not the official layout/compiler engine.
function visibleText(relativePath, data) {
  const root = { children: [] }
  const stack = [root]
  const source = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
  for (const token of source.match(/<!--[\s\S]*?-->|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g) || []) {
    if (token.startsWith('<!--')) continue
    if (token.startsWith('</')) {
      assert.equal(stack.pop().tag, token.slice(2, -1).trim())
    } else if (token.startsWith('<')) {
      const node = { tag: token.match(/^<([\w-]+)/)[1], attrs: {}, children: [] }
      for (const attr of token.matchAll(/\s([\w:-]+)(?:="([^"]*)")?/g)) node.attrs[attr[1]] = attr[2]
      stack.at(-1).children.push(node)
      if (!token.endsWith('/>')) stack.push(node)
    } else stack.at(-1).children.push(token)
  }
  assert.equal(stack.length, 1, 'WXML tags must balance')
  const evaluate = (value, scope) => vm.runInNewContext(value.slice(2, -2), scope)
  function render(nodes, scope) {
    let text = '', matched = false
    for (const node of nodes) {
      if (typeof node === 'string') {
        text += node.replace(/{{([\s\S]*?)}}/g, (_, expression) => {
          const value = vm.runInNewContext(expression, scope)
          return value == null ? '' : String(value)
        })
        continue
      }
      const attrs = node.attrs
      if ('wx:if' in attrs) {
        matched = !!evaluate(attrs['wx:if'], scope)
        if (!matched) continue
      } else if ('wx:elif' in attrs) {
        if (matched) continue
        matched = !!evaluate(attrs['wx:elif'], scope)
        if (!matched) continue
      } else if ('wx:else' in attrs) {
        if (matched) continue
        matched = true
      }
      if ('wx:for' in attrs) {
        for (const [index, item] of (evaluate(attrs['wx:for'], scope) || []).entries()) {
          text += render(node.children, { ...scope, [attrs['wx:for-item'] || 'item']: item, index })
        }
      } else text += render(node.children, scope)
    }
    return text
  }
  return render(root.children, data).replace(/\s+/g, ' ').trim()
}

module.exports = { deferred, loadPage, visibleText }
