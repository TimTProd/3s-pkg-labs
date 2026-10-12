const test = require('node:test')
const assert = require('node:assert/strict')
const model = require('../static/model.js')

function close(actual, expected, tolerance = 1e-7) {
    assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`)
}

function colorClose(actual, expected, tolerance) {
    Object.keys(expected).forEach(key => close(actual[key], expected[key], tolerance))
}

test('RGB to XYZ matches easyrgb.com formulas (D65/2°)', () => {
    let cases = [
        [{r: 255, g: 0, b: 0}, {x: 41.24, y: 21.26, z: 1.93}],
        [{r: 0, g: 255, b: 0}, {x: 35.76, y: 71.52, z: 11.92}],
        [{r: 0, g: 0, b: 255}, {x: 18.05, y: 7.22, z: 95.05}],
        [{r: 255, g: 255, b: 255}, {x: 95.05, y: 100, z: 108.9}],
        [{r: 0, g: 0, b: 0}, {x: 0, y: 0, z: 0}]
    ]
    cases.forEach(([rgb, xyz]) => colorClose(model.rgbToXyz(rgb), xyz))
})

test('XYZ to RGB: white is not reported as clipped', () => {
    let result = model.xyzToRgb({x: 95.05, y: 100, z: 108.9})
    colorClose(result.rgb, {r: 255, g: 255, b: 255}, 0.01)
    assert.equal(result.clipped, false)
})

test('1000 distinct RGB round trips stay within rounding error', () => {
    for (let i = 0; i < 1000; i++) {
        let rgb = {r: i % 256, g: Math.floor(i / 256) * 53, b: i * 97 % 256}
        let result = model.xyzToRgb(model.rgbToXyz(rgb))
        colorClose(result.rgb, rgb, 0.1)
        assert.equal(result.clipped, false)
    }
})

test('sRGB transfer functions and midgray', () => {
    close(model.linear(0.04045), 0.04045 / 12.92)
    close(model.gamma(0.0031308), 0.0031308 * 12.92)
    close(model.linear(128 / 255), 0.21586050011389926)
    close(model.gamma(model.linear(128 / 255)) * 255, 128)
})

test('HSV: all six hue sectors and 360 degrees', () => {
    let colors = [
        {r: 255, g: 0, b: 0}, {r: 255, g: 255, b: 0},
        {r: 0, g: 255, b: 0}, {r: 0, g: 255, b: 255},
        {r: 0, g: 0, b: 255}, {r: 255, g: 0, b: 255}
    ]
    colors.forEach((rgb, i) => {
        colorClose(model.rgbToHsv(rgb), {h: i * 60, s: 100, v: 100})
        colorClose(model.hsvToRgb({h: i * 60, s: 100, v: 100}), rgb)
    })
    colorClose(model.hsvToRgb({h: 360, s: 100, v: 100}), colors[0])
    colorClose(model.hsvToRgb({h: 30, s: 100, v: 100}), {r: 255, g: 127.5, b: 0})
})

test('HSV: grayscale, black and intermediate coordinates', () => {
    colorClose(model.rgbToHsv({r: 0, g: 0, b: 0}), {h: 0, s: 0, v: 0})
    colorClose(model.rgbToHsv({r: 128, g: 128, b: 128}), {h: 0, s: 0, v: 128 / 255 * 100})
    colorClose(model.hsvToRgb({h: 212.34, s: 0, v: 50}), {r: 127.5, g: 127.5, b: 127.5})
    let hsv = {h: 212.34, s: 61.23, v: 78.91}
    colorClose(model.rgbToHsv(model.hsvToRgb(hsv)), hsv)
})

test('XYZ out of gamut uses Clipping', () => {
    let result = model.xyzToRgb({x: 100, y: 0, z: 0})
    assert.equal(result.clipped, true)
    close(result.rgb.r, 255)
    close(result.rgb.g, 0)
    Object.values(result.rgb).forEach(value => assert.ok(Number.isFinite(value) && value >= 0 && value <= 255))
})

test('HEX conversion and display rounding', () => {
    assert.equal(model.rgbToHex({r: 255, g: 127.5, b: 0}), '#ff8000')
    assert.deepEqual(model.hexToRgb('#4f86c6'), {r: 79, g: 134, b: 198})
})
