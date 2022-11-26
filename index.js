require('dotenv').config()
const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const uuid = require('uuid')
const DiscordOauth2 = require('discord-oauth2')
const oauth = new DiscordOauth2()
const sqlite3 = require('sqlite3')
const cb = new sqlite3.Database('.db')

const port = process.env.PORT
const size = process.env.CANVAS_SIZE
const clientID = process.env.DISCORD_CLIENT_ID
const clientSecret = process.env.DISCORD_CLIENT_SECRET

class User {
    static cooldown = process.env.COOLDOWN

    constructor(discordAccessToken) {
        this.discordAccessToken = discordAccessToken
        this.timestamp = null
    }
}

let users = {}
let grid = {}

function putPixel(token, x, y, color) {
    if (!grid.hasOwnProperty(x)) {
        grid[x] = {}
    }

    grid[x][y] = {token: token, color: color}
}

function validateToken(str) {
    if (users.hasOwnProperty(str)) {
        return {valid: true, value: str}
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

app.get('/token', async (req, res) => {
    const code = req.query.code

    oauth.tokenRequest({
        clientId: clientID,
        clientSecret: clientSecret,
        code: code,
        grantType: 'authorization_code',
        redirectUri: 'http://localhost:2000/token'
    }).then(response => {
        const discordAccessToken = response.access_token

        // Generate token associated solely with this api.
        let token = uuid.v4()

        // Remove any previous tokens for this user.
        for (let [t, user] of Object.entries(users)) {
            if (discordAccessToken == user.discordAccessToken) {
                delete users[t]
            }
        }

        // Put user in lookup table.
        users[token] = new User(discordAccessToken)

        res.send(token)
    }).catch(err => {
        res.send('error')
    })
})

// example.com/test?token=<string>
app.get('/test', async (req, res) => {
    const token = req.query.token
    const discordAccessToken = users[token].discordAccessToken

    oauth.getUser(discordAccessToken).then(user => {
        res.send(`hello ${user.username}.`)
    }).catch(() => {
        res.send('error')
    })
})

// example.com/put-pixel?token=<string>?x=<int>?y=<int>?color=<int>
app.get('/put-pixel', (req, res) => {
    const token = validateToken(req.query.token)
    const x = validateCoord(req.query.x)
    const y = validateCoord(req.query.y)
    const color = validateColor(req.query.color)

    let errors = []

    if (token.valid && x.valid && y.valid && color.valid) {
        let user = users[token.value]
        let now = performance.now()

        if (user.timestamp == null || now - user.timestamp >= User.cooldown) {
            putPixel(token.value, x.value, y.value, color.value)
            user.timestamp = now

            io.emit('update', {x: x.value, y: y.value, color: color.value})
            res.send('success')
            return
        }
        else {
            errors.push(`Cooldown ${((User.cooldown - (now - user.timestamp)) / 1000).toFixed(1)}s.`)
        }
    }

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
            cells.push({x: x, y: y, color: cell.color})
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
