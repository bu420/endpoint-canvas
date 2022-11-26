const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')
const socket = io()

// https://stackoverflow.com/a/46920541
const dpr = window.devicePixelRatio
ctx.scale(dpr, dpr)

function setCanvasSize() {
    canvas.width = window.innerWidth * 2
    canvas.height = window.innerHeight * 2
}
setCanvasSize()

addEventListener('resize', () => {
    setCanvasSize()
})

let showGrid = true
document.getElementById('grid-checkbox').addEventListener('change', (e) => {
    showGrid = e.currentTarget.checked
})

// https://androidarts.com/palette/16pal.htm
const palette = ["#000000", "#9D9D9D", "#FFFFFF", "#BE2633", "#E06F8B", "#493C2B", "#A46422", "#EB8931", "#F7E26B", "#2F484E", "#44891A", "#A3CE27", "#1B2632", "#005784", "#31A2F2", "#B2DCEF"]

let grid = {}

function putPixel(x, y, color) {
    if (!grid.hasOwnProperty(x)) {
        grid[x] = {}
    }

    grid[x][y] = {color: color}
}

socket.on('initial', initialData => {
    initialData.cells.forEach(cell => {
        putPixel(cell.x, cell.y, cell.color)
    })
    
    socket.on('update', updateData => {
        putPixel(updateData.x, updateData.y, updateData.color)
    })

    const size = initialData.size

    // Draw grid.
    setInterval(() => {
        let ratio = canvas.width / canvas.height
        let cellSize = (ratio >= 1 ? canvas.height : canvas.width) / size
        let offset = { x: ratio >= 1 ? (canvas.width - size * cellSize) / 2 : 0, y: ratio < 1 ? (canvas.height - size * cellSize) / 2 : 0 }

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw cells.
        for (const [x, col] of Object.entries(grid)) {
            for (const [y, cell] of Object.entries(col)) {
                const pos = {x: offset.x + x * cellSize, y: offset.y + y * cellSize}
                
                ctx.fillStyle = palette[cell.color]
                ctx.fillRect(pos.x, pos.y, cellSize, cellSize)
            }
        }

        if (showGrid) {
            ctx.strokeStyle = '#888888'
            for (let i = 0; i <= size; i++) {
                // Vertical lines.
                ctx.beginPath()
                ctx.moveTo(offset.x + i * cellSize, offset.y)
                ctx.lineTo(offset.x + i * cellSize, offset.y + size * cellSize)
                ctx.stroke()

                // Horizontal lines.
                ctx.beginPath()
                ctx.moveTo(offset.x, offset.y + i * cellSize)
                ctx.lineTo(offset.x + size * cellSize, offset.y + i * cellSize)
                ctx.stroke()
            }
        }
    }, 0)
})
