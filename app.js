const express = require('express')
const mysql = require('mysql')
const path = require('path')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const cookieParser = require('cookie-parser')
dotenv.config({ path: './.env' })

//dijkstras file
const dijkstras = require('./dijkstras.js');
const { findShortestPath } = require('./dijkstras.js')

const app = express()
app.set('view engine', 'hbs');
const publicDirectory = path.join(__dirname, './public');

app.use(express.static(publicDirectory));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser())

// database connection
const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
})

db.connect((error) => {
    if (error) {
        console.log(error)
    }
    else {
        console.log("Mysql connected")
    }
})

// creating graph
var graph = {}
db.query('SELECT * FROM ROAD', (error, results) => {
    if (error) {
        console.log(error)
    }
    for (let i = 0; i < results.length; i++) {
        var junc1 = results[i].junction1_id
        var junc2 = results[i].junction2_id
        var dist = results[i].distance


        if (graph[junc1] == null) {
            graph[junc1] = {}
        }
        graph[junc1][junc2] = dist
    }
})

// index page
app.get("/", (req, res) => {
    res.render("index")
})

// register page
app.get("/register", (req, res) => {
    res.render("register")
})

//login page
app.get("/login", (req, res) => {
    res.render("login")
})

// main page
app.get("/main", (req,res) => {
    res.sendFile('views/main.html', {root: __dirname })
})

// shortest path page
app.get("/path", (req, res) => {
    res.render("path")
})

// dynamic traffic signalling
app.get("/dynamic", (req,res) => {
    res.sendFile('views/dynamic.html', {root: __dirname })
})

//registering
app.post("/register", (req, res) => {
    const { name, email, password, passwordConfirm } = req.body
    db.query('SELECT EMAIL FROM USER WHERE EMAIL = ?', [email], async (error, results) => {
        if (error) {
            console.log(error)
        }
        if (results.length > 0) {
            res.render('register', {
                message: 'That email is already in use'
            })
        }
        else if (password != passwordConfirm) {
            res.render('register', {
                message: 'Passwords do not match'
            })
        }

        let hashedPassword = await bcrypt.hash(password, 8)
        db.query('INSERT INTO user (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword], (error, result) => {
            if (error) {
                console.log(error)
            }
            res.render('register', {
                success: 'User registered successfully'
            })
        })
    })
})

// logging in
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            res.status(400).render("login", {
                message: 'Please provide an email and password'
            })
        }
        db.query('SELECT * FROM user WHERE email = ?', [email], async (error, results) => {
            if (results.length == 0) {
                res.status(401).render("login", {
                    message: 'Email is not registered!'
                })
            }
            else if (!(await bcrypt.compare(password, results[0].password))) {
                res.status(401).render("login", {
                    message: 'Incorrect password'
                })
            }
            else {
                const email = results[0].email
                const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
                    expiresIn: process.env.JWT_EXPIRES_IN
                })
                console.log("The token is " + token)
                const cookieOptions = {
                    expires: new Date(
                        Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000
                    ),
                    httpOnly: true
                }
                res.cookie('jwt', token, cookieOptions)
                res.sendFile('views/main.html', {root: __dirname })
            }

        })
    } catch (error) {

    }
})

//shortest path
app.post("/shortestpath", async (req, res) => {
    const { start, end } = req.body
    var route = findShortestPath(graph, start, end)
    res.render("path", {
        result:1,
        distance: route.distance,
        path: route.path 
    })
})

//vehicle search
app.get("/vehicle_search", (req,res) => {
    res.render("vehicle_search")
})

app.post("/vehicle_search/find",(req,res) => {
    var reg_no = req.body.reg_no;
    db.query('select * from vehicle where reg_no = ?',[reg_no],(error,results) => {
        if (error) {
            console.log("search error");
        }
        else {
            res.render('vehicle_search', {
                vehicle: results[0],
                check: 1,
                size: Array.isArray(results) && results.length
            })
        }
    })
})

//vehicle insert
app.get("/vehicle_insert", (req,res) => {
    res.render("vehicle_insert")
})

app.post("/vehicle_insert/addrecord", (req, res) => {
    var regno = req.body.reg_no
    var ownername = req.body.owner_name
    var vehicletype = req.body.vehicle_type
    var fueltype = req.body.fuel_type
    var modelname = req.body.model
    var colourname = req.body.colour
    db.query("INSERT INTO vehicle value (?, ?, ?, ?, ?, ?)", [regno,ownername,vehicletype,fueltype,modelname,colourname],(error,results) =>{
        if (error) {
            console.log(error)
        }
        else {
            res.render('vehicle_insert', {
                addFail: error,
                check: 1
            })
        }
    })
})


//vehicle all records
app.get("/vehicle_records",(req,res) => {
    db.query("select * from vehicle", (error,results) => {
        if (error) {
            console.log(error);
        }
        else {
            res.render('vehicle_records', {
                vehicle: results
            })
        }
    })
})

app.post("/vehicle_records",(req,res) => {
    db.query("select * from vehicle", (error,results) => {
        if (error) {
            console.log("show error");
        }
        else {
            res.render('vehicle_records', {
                vehicle: results
            })
        }
    })
})

//vehicle delete
app.post("/vehicle_delete/(:id)",(req,res) => {
    db.query("delete from vehicle where reg_no = ?",[req.params.id], (error,results) => {
        if (error) {
            console.log("delete error");
        }
    })
    db.query("select * from vehicle", (error,results) => {
        if (error) {
            console.log("show error");
        }
        else {
            res.render('vehicle_records', {
                vehicle: results
            })
        }
    })

})

//fine search
app.get("/fine_search", (req,res) => {
    res.render("fine_search")
})

app.post("/fine_search/find",(req,res) => {
    var fid = req.body.fine_id;
    db.query('select * from fine where fine_id = ?',[fid],(error,results) => {
        if (error) {
            console.log("search error");
        }
        else {
            res.render('fine_search', {
                fine: results[0],
                check: 1,
                size: Array.isArray(results) && results.length
            })
        }
    })
})

//fine insert
app.get("/fine_insert", (req,res) => {
    res.render("fine_insert")
})

app.post("/fine_insert/addrecord", (req, res) => {
    var fid=req.body.fine_id
    var regno = req.body.reg_no
    var jid = req.body.junction_id
    var tpid = req.body.tp_id
    var reason = req.body.reason
    var date = req.body.date
    var time = req.body.time
    var amount=req.body.amount
    db.query("INSERT INTO fine value (?, ?, ?, ?, ?, ?, ?, ?)", [fid,regno,jid,tpid,reason,date,time,amount],(error,results) =>{
        if (error) {
            console.log(error)
        }
        else {
            res.render('fine_insert', {
                addFail: error,
                check: 1
            })
        }
    })
})

//fine records
app.get("/fine_records",(req,res) => {
    db.query("select * from fine", (error,results) => {
        if (error) {
            console.log(error);
        }
        else {
            res.render('fine_records', {
                fine: results
            })
        }
    })
})

app.post("/fine_records",(req,res) => {
    db.query("select * from fine", (error,results) => {
        if (error) {
            console.log("show error");
        }
        else {
            res.render('fine_records', {
                fine: results
            })
        }
    })
})

//fine delete
app.post("/fine_delete/(:id)",(req,res) => {
    db.query("delete from fine where fine_id = ?",[req.params.id], (error,results) => {
        if (error) {
            console.log("delete error");
        }
    })
    db.query("select * from fine", (error,results) => {
        if (error) {
            console.log("show error");
        }
        else {
            res.render('fine_records', {
                fine: results
            })
        }
    })

})

//traffic records
app.get("/traffic_records",(req,res) => {
    db.query("select * from traffic_records", (error,results) => {
        if (error) {
            console.log(error);
        }
        else {
            res.render('traffic_records', {
                traffic_record: results
            })
        }
    })
})

app.post("/traffic_records",(req,res) => {
    db.query("select * from traffic_records", (error,results) => {
        if (error) {
            console.log(error);
        }
        else {
            res.render('traffic_records', {
                traffic_record: results
            })
        }
    })
})

//traffic delete
app.post("/traffic_delete/(:id)",(req,res) => {
    db.query("delete from traffic_records where event_id = ?",[req.params.id], (error,results) => {
        if (error) {
            console.log("delete error");
        }
    })
    db.query("select * from traffic_records", (error,results) => {
        if (error) {
            console.log("show error");
        }
        else {
            res.render('traffic_records', {
                traffic_record: results
            })
        }
    })

})

//traffic insert
app.get("/traffic_insert", (req,res) => {
    res.render("traffic_insert")
})

app.post("/traffic_insert/addrecord", (req, res) => {
    const {event_id,camera_id,reg_no,junction_id,road_id,event_time,event_date} = req.body
    db.query("INSERT INTO traffic_records value (?, ?, ?, ?, ?, ?, ?)", [event_id,camera_id,reg_no,junction_id,road_id,event_time,event_date],(error,results) =>{
        if (error) {
            console.log(error)
        }
        else {
            res.render('traffic_insert', {
                addFail: error,
                check: 1
            })
        }
    })
})

app.listen(5000, () => {
    console.log("server started on port 5000")
})