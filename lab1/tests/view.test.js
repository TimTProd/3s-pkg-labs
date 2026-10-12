const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

function setup(model, max) {
    let handlers = {}
    let calls = []
    let number = {
        value: '50', min: '0', max: String(max), dataset: {accepted: '50'}, validity: {badInput: false},
        get valueAsNumber() { return this.value === '' ? NaN : Number(this.value) },
        addEventListener: (name, handler) => handlers[name] = handler
    }
    let slider = {setAttribute() {}, addEventListener() {}}
    let row = {
        dataset: {name: model === 'rgb' ? 'r' : 'h'},
        closest: () => ({dataset: {model}}),
        querySelector: selector => selector === '.number' ? number : slider
    }
    let document = {
        querySelectorAll: selector => selector === '.component' ? [row] : [],
        querySelector: () => ({addEventListener() {}})
    }
    let source = fs.readFileSync(path.join(__dirname, '../static/view.js'), 'utf8')
    vm.runInNewContext(source + '\nColorView.bind((...args) => calls.push(args), () => {}, () => {}, () => {})', {document, calls})
    return {number, handlers, calls}
}

test('numeric inputs reject invalid pasted values and restore the last value', () => {
    let app = setup('rgb', 255)
    for (let value of ['256', '-1', '1e2', '12.5', 'abc']) {
        app.number.value = value
        app.handlers.input()
        assert.equal(app.number.value, '50')
        assert.equal(app.calls.length, 0)
    }
    app.number.value = ''
    app.number.validity.badInput = true
    app.handlers.input()
    assert.equal(app.number.value, '50')
})

test('valid boundaries and decimal HSV input are accepted', () => {
    let app = setup('hsv', 360)
    for (let value of ['0', '212.34', '360']) {
        app.number.value = value
        app.handlers.input()
        assert.equal(app.calls.at(-1)[2], Number(value))
        assert.equal(app.number.dataset.accepted, value)
    }
    app.number.value = '361'
    app.handlers.input()
    assert.equal(app.number.value, '360')
    app.number.value = ''
    app.handlers.input()
    assert.equal(app.number.value, '')
    assert.equal(app.calls.length, 3)
})

test('invalid typing is blocked without blocking keyboard shortcuts', () => {
    let app = setup('rgb', 255)
    for (let key of ['e', 'E', '+', '-', '.', ',']) {
        let blocked = false
        app.handlers.keydown({key, preventDefault: () => blocked = true})
        assert.equal(blocked, true)
    }
    let blocked = false
    app.handlers.keydown({key: 'e', ctrlKey: true, preventDefault: () => blocked = true})
    assert.equal(blocked, false)
})
