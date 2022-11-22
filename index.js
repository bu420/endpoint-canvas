require('dotenv').config()
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const uuid = require('uuid')
const port = process.env.PORT
const size = process.env.SIZE

let users = {}
let grid = {}

function putPixel(token, x, y, color) {
    if (!grid.hasOwnProperty(x)) {
        grid[x] = {}
    }

    grid[x][y] = {token: token, color: color}
}

function validateToken(str) {
    if (str) {
        if (users.hasOwnProperty(str)) {
            return {valid: true, value: str}
        }
    }
    return {valid: false, value: null}
}

function validateString(str) {
    if (str) {
        str = str.trim()
        if (str.length > 0) {
            return {valid: true, value: str}
        }
    }
    return {valid: false, value: null}
}

function validateInt(str) {
    if (str) {
        const num = parseInt(str.trim(), 10)
        if (!isNaN(num)) {
            return {valid: true, value: num}
        }
    }
    return {valid: false, value: null}
}

function validateBounds(str, min, max) {
    let int = validateInt(str)
    if (int.valid && (int.value < min || int.value >= max)) {
        return {valid: false, value: null}
    }
    return int
}

function validateCoord(str) {
    return validateBounds(str, 0, size)
}

function validateColor(str) {
    return validateBounds(str, 0, 16)
}

app.use(express.static(__dirname + '/public'))

// example.com/create-account?name=<string>
app.get('/create-account', (req, res) => {
    const name = validateString(req.query.name)
    if (!name.valid) {
        res.json({error: `Invalid or missing parameter 'name'.`})
        return
    }

    let token = uuid.v4()
    users[token] = name.value
    res.json({token: token, name: name.value})
})

// example.com/put-pixel?token=<string>?x=<int>?y=<int>?color=<int>
app.get('/put-pixel', (req, res) => {
    const token = validateToken(req.query.token)
    const x = validateCoord(req.query.x)
    const y = validateCoord(req.query.y)
    const color = validateColor(req.query.color)

    if (token.valid && x.valid && y.valid && color.valid) {
        putPixel(token.value, x.value, y.value, color.value)
        res.send('success')
        io.emit('update', {x: x.value, y: y.value, color: color.value, name: users[token.value]})
        return
    }

    let errors = []

    if (!token.valid)
        errors.push(`Invalid or missing parameter 'token'.`)
    if (!x.valid)
        errors.push(`Invalid or missing parameter 'x'. Must be an integer from 0 to ${size}.`)
    if (!y.valid)
        errors.push(`Invalid or missing parameter 'y'. Must be an integer from 0 to ${size}.`)
    if (!color.valid)
        errors.push(`Invalid or missing parameter 'color'. Must be an integer from 0 to 16.`)

    res.json({errors: errors})
})

io.on('connection', (socket) => {
    let cells = []

    for (const [x, col] of Object.entries(grid)) {
        for (const [y, cell] of Object.entries(col)) {
            cells.push({x: x, y: y, color: cell.color, name: users[cell.token]})
        }
    }

    socket.emit('initial', {
        size: size,
        cells: cells
    })
})

server.listen(port, () => {
    console.log(`Server running on port ${port}.`)
})
