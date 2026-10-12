const ColorModel = (() => {
    // Матрицы sRGB (D65/2°) с коэффициентами как на easyrgb.com/en/math.php
    const toXyz = [
        [0.4124, 0.3576, 0.1805],
        [0.2126, 0.7152, 0.0722],
        [0.0193, 0.1192, 0.9505]
    ]
    const toRgb = [
        [3.2406, -1.5372, -0.4986],
        [-0.9689, 1.8758, 0.0415],
        [0.0557, -0.2040, 1.0570]
    ]
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

    function multiply(matrix, vector) {
        return matrix.map(row => row.reduce((sum, value, i) => sum + value * vector[i], 0))
    }

    function linear(value) {
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }

    function gamma(value) {
        return value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
    }

    function rgbToXyz(rgb) {
        let values = multiply(toXyz, [rgb.r, rgb.g, rgb.b].map(value => linear(value / 255)))
        return {x: values[0] * 100, y: values[1] * 100, z: values[2] * 100}
    }

    function xyzToRgb(xyz) {
        let values = multiply(toRgb, [xyz.x / 100, xyz.y / 100, xyz.z / 100])
            .map(value => gamma(value) * 255)
        // выход за границы больше, чем на погрешность округления до целого
        let clipped = values.some(value => value < -0.5 || value > 255.5)
        values = values.map(value => clamp(value, 0, 255))
        return {rgb: {r: values[0], g: values[1], b: values[2]}, clipped}
    }

    function rgbToHsv(rgb) {
        let r = rgb.r / 255
        let g = rgb.g / 255
        let b = rgb.b / 255
        let max = Math.max(r, g, b)
        let min = Math.min(r, g, b)
        let difference = max - min
        let h = 0
        if (difference !== 0) {
            if (max === r) h = 60 * (((g - b) / difference) % 6)
            else if (max === g) h = 60 * ((b - r) / difference + 2)
            else h = 60 * ((r - g) / difference + 4)
        }
        if (h < 0) h += 360
        return {h, s: max === 0 ? 0 : difference / max * 100, v: max * 100}
    }

    function hsvToRgb(hsv) {
        let h = hsv.h % 360
        let s = hsv.s / 100
        let v = hsv.v / 100
        let c = v * s
        let x = c * (1 - Math.abs((h / 60) % 2 - 1))
        let m = v - c
        let values
        if (h < 60) values = [c, x, 0]
        else if (h < 120) values = [x, c, 0]
        else if (h < 180) values = [0, c, x]
        else if (h < 240) values = [0, x, c]
        else if (h < 300) values = [x, 0, c]
        else values = [c, 0, x]
        values = values.map(value => (value + m) * 255)
        return {r: values[0], g: values[1], b: values[2]}
    }

    function rgbToHex(rgb) {
        return '#' + [rgb.r, rgb.g, rgb.b].map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')
    }

    function hexToRgb(hex) {
        return {r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16)}
    }

    return {clamp, multiply, linear, gamma, rgbToXyz, xyzToRgb, rgbToHsv, hsvToRgb, rgbToHex, hexToRgb}
})()

if (typeof module !== 'undefined') module.exports = ColorModel
