const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ColorModel = require('../static/model.js')

function setup() {
    let result = {}
    let components = [
        ['rgb', 'r', 255], ['rgb', 'g', 255], ['rgb', 'b', 255],
        ['xyz', 'x', 100], ['xyz', 'y', 100], ['xyz', 'z', 110],
        ['hsv', 'h', 360], ['hsv', 's', 100], ['hsv', 'v', 100]
    ].map(([model, name, max]) => ({model, name, min: 0, max}))
    let ColorView = {
        components: () => components,
        bind: (...callbacks) => result.callbacks = callbacks,
        render: (state, hex, message, active) => Object.assign(result, {state, hex, message, active}),
        gradients: colors => result.colors = colors
    }
    let source = fs.readFileSync(path.join(__dirname, '../static/script.js'), 'utf8')
    vm.runInNewContext(source, {ColorModel, ColorView})
    return result
}

test('RGB edits update other models and neighboring gradients', () => {
    let app = setup()
    let gradient = app.colors[1].join(',')
    app.callbacks[0]('rgb', 'r', 255, 0, 255)
    assert.equal(app.hex, '#ff86c6')
    assert.equal(app.state.rgb.r, 255)
    assert.notEqual(app.colors[1].join(','), gradient)
    assert.equal(app.colors.length, 9)
    assert.ok(app.colors.every(colors => colors.length === 31))
})

test('source HSV stays precise and active input is preserved', () => {
    let app = setup()
    let active = {}
    app.callbacks[0]('hsv', 'h', 212.34, 0, 360, active)
    app.callbacks[0]('hsv', 's', 61.23, 0, 100, active)
    assert.equal(app.state.hsv.h, 212.34)
    assert.equal(app.state.hsv.s, 61.23)
    assert.equal(app.active, active)
    app.callbacks[2]()
    assert.equal(app.active, null)
})

test('XYZ coordinates are retained with a clipping warning', () => {
    let app = setup()
    app.callbacks[0]('xyz', 'x', 100, 0, 100)
    app.callbacks[0]('xyz', 'y', 0, 0, 100)
    app.callbacks[0]('xyz', 'z', 0, 0, 110)
    assert.equal(app.state.xyz.x, 100)
    assert.equal(app.state.xyz.y, 0)
    assert.match(app.message, /Clipping/)
    app.callbacks[1]('#00ff00')
    assert.equal(app.hex, '#00ff00')
    assert.equal(app.message, '')
})

test('out of range and invalid numbers leave the color unchanged', () => {
    let app = setup()
    let hex = app.hex
    for (let value of [270, -1, NaN, Infinity, 12.5]) {
        app.callbacks[0]('rgb', 'r', value, 0, 255)
        assert.equal(app.hex, hex)
    }
})
