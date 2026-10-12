let state = {rgb: {r: 79, g: 134, b: 198}}
let message = ''
const components = ColorView.components()

function refresh(activeInput = null) {
    ColorView.render(state, ColorModel.rgbToHex(state.rgb), message, activeInput)
    let colors = components.map(({model, name, min, max}) => {
        let stops = []
        for (let i = 0; i <= 30; i++) {
            let values = {...state[model], [name]: min + (max - min) * i / 30}
            let rgb = values
            if (model === 'xyz') rgb = ColorModel.xyzToRgb(values).rgb
            if (model === 'hsv') rgb = ColorModel.hsvToRgb(values)
            stops.push(ColorModel.rgbToHex(rgb))
        }
        return stops
    })
    ColorView.gradients(colors)
}

function setColor(rgb, source = 'rgb', values = rgb, activeInput = null) {
    state = {rgb, xyz: ColorModel.rgbToXyz(rgb), hsv: ColorModel.rgbToHsv(rgb)}
    state[source] = values
    refresh(activeInput)
}

function changeComponent(model, name, value, min, max, activeInput) {
    if (!Number.isFinite(value) || value < min || value > max || (model === 'rgb' && !Number.isInteger(value))) return
    let bounded = ColorModel.clamp(value, min, max)
    let values = {...state[model], [name]: bounded}
    message = bounded !== value ? 'Введённое значение ограничено допустимым диапазоном.' : ''
    let rgb = values
    if (model === 'hsv') rgb = ColorModel.hsvToRgb(values)
    if (model === 'xyz') {
        let result = ColorModel.xyzToRgb(values)
        rgb = result.rgb
        if (result.clipped) message = 'Цвет вне гаммы RGB. Применено обрезание (Clipping).'
    }
    setColor(rgb, model, values, activeInput)
}

ColorView.bind(changeComponent, hex => {
    message = ''
    setColor(ColorModel.hexToRgb(hex))
}, () => refresh())

setColor(state.rgb)
