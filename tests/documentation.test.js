import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = new URL('../', import.meta.url)
const readme = readFileSync(new URL('README.md', root), 'utf8')
const references = [...readme.matchAll(/(?:!?\[[^\]]*\]\(([^)\s]+)\)|<img\b[^>]*\bsrc="([^"]+)")/g)].map(match => match[1] ?? match[2])
const local = references.filter(reference => !reference.startsWith('#') && !/^https?:/.test(reference))

test('README references resolve to files inside the project', () => {
  assert.ok(local.length > 15)
  for (const reference of local) {
    const target = new URL(reference.split('#')[0], root)
    assert.ok(fileURLToPath(target).startsWith(fileURLToPath(root)), `${reference} escapes the project`)
    assert.ok(statSync(target).isFile(), `${reference} is missing`)
  }
})

test('the showcase includes ten valid screenshots, including a mobile viewport', () => {
  const screenshots = [...new Set(local.filter(reference => reference.endsWith('.png')))]
  assert.equal(screenshots.length, 10)
  for (const reference of screenshots) {
    const image = PNG.sync.read(readFileSync(new URL(reference, root)))
    assert.ok(image.width >= 390 && image.height >= 800, `${reference} is undersized`)
    assert.equal(image.width < image.height, reference.endsWith('/mobile.png'))
  }
})