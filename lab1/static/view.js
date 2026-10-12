const ColorView = (() => {
    const rows = Array.from(document.querySelectorAll('.component'))
    const palettes = Array.from(document.querySelectorAll('.palette'))

    function render(values, hex, message, activeInput = null) {
        rows.forEach(row => {
            let model = row.closest('.model').dataset.model
            let value = values[model][row.dataset.name]
            let digits = model === 'rgb' ? 0 : model === 'hsv' ? 1 : 2
            let number = row.querySelector('.number')
            if (number !== activeInput) number.value = Number(value.toFixed(digits))
            number.dataset.accepted = number.value
            row.querySelector('.slider').value = value
        })
        palettes.forEach(input => input.value = hex)
        document.querySelector('#colorPreview').style.background = hex
        document.querySelector('#hexValue').textContent = hex.toUpperCase()
        document.querySelector('#warning').textContent = message
    }

    function gradients(colors) {
        rows.forEach((row, i) => row.querySelector('.slider').style.background = `linear-gradient(to right, ${colors[i].join(', ')})`)
    }

    function bind(onComponent, onPalette, onFinish) {
        rows.forEach(row => {
            let model = row.closest('.model').dataset.model
            let name = row.dataset.name
            let number = row.querySelector('.number')
            let slider = row.querySelector('.slider')
            slider.setAttribute('aria-label', `${name.toUpperCase()} ${model.toUpperCase()}`)
            number.addEventListener('keydown', event => {
                if (event.ctrlKey || event.metaKey || event.altKey) return
                if (['e', 'E', '+', '-'].includes(event.key) || (model === 'rgb' && ['.', ','].includes(event.key))) event.preventDefault()
            })
            number.addEventListener('input', () => {
                if (number.value === '' && !number.validity.badInput) return
                let value = number.valueAsNumber
                let pattern = model === 'rgb' ? /^\d+$/ : /^\d+(\.\d*)?$/
                if (!pattern.test(number.value) || !Number.isFinite(value) || value < Number(number.min) || value > Number(number.max)) {
                    number.value = number.dataset.accepted
                    return
                }
                number.dataset.accepted = number.value
                onComponent(model, name, number.valueAsNumber, Number(number.min), Number(number.max), number)
            })
            slider.addEventListener('input', () => onComponent(model, name, Number(slider.value), Number(slider.min), Number(slider.max)))
            number.addEventListener('blur', onFinish)
        })
        palettes.forEach(input => input.addEventListener('input', () => onPalette(input.value)))
    }

    function components() {
        return rows.map(row => {
            let slider = row.querySelector('.slider')
            return {model: row.closest('.model').dataset.model, name: row.dataset.name, min: Number(slider.min), max: Number(slider.max)}
        })
    }

    return {render, gradients, bind, components}
})()
