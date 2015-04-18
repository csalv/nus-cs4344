/*
 * MMOServer.js
 * A skeleton server for massively multiplayer space battle.
 * Assignment 3 for CS4344, AY2013/14.
 *
 * Usage: 
 *   node MMOServer.js
 */

"use strict"; 

var LIB_PATH = "./";
require(LIB_PATH + "Config.js");
require(LIB_PATH + "Ship.js");
require(LIB_PATH + "Rocket.js");
require(LIB_PATH + "Player.js");
require(LIB_PATH + "gridObject.js");

function MMOServer() {
    // private Variables
    var nextPID = 0;  // PID to assign to next connected player 
    var ships = {};   // Associative array for ships, indexed via player ID
    var rockets = {}; // Associative array for rockets, indexed via timestamp
    var sockets = {}; // Associative array for sockets, indexed via player ID
    var players = {}; // Associative array for players, indexed via socket ID

    /*
    Grid Layout:
    ////////////////////////
    //  Grid0  //  Grid1  //  
    ////////////////////////
    //  Grid2  //  Grid3  //
    ////////////////////////
    */
    var grid; // 2d-array of gridObjects

    var initGrid = function() {
        // Grid is organized into rows of 2
        var i, j, xPos, yPos;
        var gid = 0; // Grid ID

        grid = new Array(Config.NO_OF_GRIDS/2);
        for(i=0; i<grid.length; i++) {
            grid[i] = new Array(Config.NO_OF_GRIDS/2);
            for(j=0; j<grid[i].length; j++) {
                xPos = Config.GRID_LENGTH * j; // Set top LHS corner of grid
                yPos = Config.GRID_HEIGHT * i; // Set top LHS corner of grid

                grid[i][j] = new gridObject(gid, xPos, yPos);
                gid++;

                console.log(grid[i][j]);
            }
        }
    }

    /*
     * private method: broadcast(msg)
     *
     * broadcast takes in a JSON structure and send it to
     * all players.
     *
     * e.g., broadcast({type: "abc", x: 30});
     */
    var broadcast = function (msg) {
        var id;
        for (id in sockets) {
            sockets[id].write(JSON.stringify(msg));
        }
    }

    // Broadcast to everyone in the grid
    var broadcastInGrid = function(msg, i, j) {
        var id;
        for(id in grid[i][j].ships) sockets[id].write(JSON.stringify(msg));
    }

    // Broadcast to everyone in the grid except for the given player ID
    var broadcastInGridUnless = function(msg, i, j, pid) {
        var id;
        for(id in grid[i][j].ships) {
            if(id != pid) sockets[id].write(JSON.stringify(msg));
        }
    }

    /*
     * private method: broadcastUnless(msg, id)
     *
     * broadcast takes in a JSON structure and send it to
     * all players, except player id
     *
     * e.g., broadcast({type: "abc", x: 30}, pid);
     */
    var broadcastUnless = function (msg, pid) {
        var id;
        for (id in sockets) {
            if (id != pid)
                sockets[id].write(JSON.stringify(msg));
        }
    }

    /*
     * private method: unicast(socket, msg)
     *
     * unicast takes in a socket and a JSON structure 
     * and send the message through the given socket.
     *
     * e.g., unicast(socket, {type: "abc", x: 30});
     */
    var unicast = function (socket, msg) {
        socket.write(JSON.stringify(msg));
    }

    /*
     * private method: newPlayer()
     *
     * Called when a new connection is detected.  
     * Create and init the new player.
     */
    var newPlayer = function (conn) {
        nextPID ++;
        // Create player object and insert into players with key = conn.id
        players[conn.id] = new Player();
        players[conn.id].pid = nextPID;
        sockets[nextPID] = conn;
    }

    var getModulo = function(i, n) {
        // Note: JS modulo doesn't work for -ve numbers,
        // Need to do it in another way
        return ((i%n)+n)%n;
    }

    /*
     * private method: gameLoop()
     *
     * The main game loop.  Called every interval at a
     * period roughly corresponding to the frame rate 
     * of the game
     */
    var gameLoop = function () {
        var i, j, k, l;
        for (i in ships) {
            ships[i].moveOneStep();

            var leftMostX   = getModulo((ships[i].x-Config.AOI_LENGTH), Config.WIDTH);
            var rightMostX  = (ships[i].x + Config.AOI_LENGTH) % Config.WIDTH;
            var topMostY    = getModulo((ships[i].y-Config.AOI_HEIGHT), Config.HEIGHT);
            var bottomMostY = (ships[i].y + Config.AOI_HEIGHT) % Config.HEIGHT;            

            // Check if player's AOI overlaps with any grids
            // For each grid it overlaps with, subscribe to that grid
            // For each grid we leave, unsubscribe to it
            checkGridIntersection(leftMostX, rightMostX, topMostY, bottomMostY, i, "ship");
        }

        for (i in rockets) {
            rockets[i].moveOneStep();
            // remove out of bounds rocket
            if (rockets[i].x < 0 || rockets[i].x > Config.WIDTH ||
                rockets[i].y < 0 || rockets[i].y > Config.HEIGHT) {
                rockets[i] = null;
                delete rockets[i];
                // inform all grids that rocket is gone
                for(j in grid) for (k in grid[j]) grid[j][k].removeRocket(i);
            } else {
                // Rocket is still in play, check which grid the rocket belongs to
                // Rockets can only belong to at most 1 grid
                checkGridIntersection(rockets[i].x, rockets[i].x, rockets[i].y, rockets[i].y, i, "rocket");

                for(j in grid) for (k in grid[j]) { // For all grids
                    if(grid[j][k].isRocketInGrid(i)==true) { // See if this rocket belongs in that grid
                        for(l in grid[j][k].ships) { // For all ships in the grid
                            if (rockets[i] != undefined && rockets[i].from != l) {
                                if (rockets[i].hasHit(ships[l])) {
                                    // tell everyone there is a hit
                                    broadcastInGrid({type:"hit", rocket:i, ship:l}, j, k) // Need to broadcast within grid ONLY
                                    delete rockets[i];
                                    // inform all grids that rocket is gone
                                    grid[j][k].removeRocket(i);
                                    break;
                                }
                            }
                        }
                    }

                    break;
                }
            }
        }
    }

    var checkGridIntersection = function(leftMostX, rightMostX, topMostY, bottomMostY, id, rocketOrShip) {
        // Check y-coord for intersection with ROW grids
        // Check x-coord for intersection with COLUMN grids
        var i, j, inRange;

        for(i in grid) { // For all column grids
            for(j in grid[i]) { // For all row grids
                inRange = false;
                //If this left most x-coord or right most x-coord falls in grid range
                if((leftMostX>=grid[i][j].topLeftX && leftMostX<=(grid[i][j].topLeftX+Config.GRID_LENGTH)) ||
                    (rightMostX>=grid[i][j].topLeftX && rightMostX<=(grid[i][j].topLeftX+Config.GRID_LENGTH))) {
                    // This object is within the x-range of this grid
                    if((topMostY>=grid[i][j].topLeftY && topMostY<=(grid[i][j].topLeftY+Config.GRID_HEIGHT)) ||
                        (bottomMostY>=grid[i][j].topLeftY && bottomMostY<=(grid[i][j].topLeftY+Config.GRID_HEIGHT))) {
                        // This object is within the y-range of this grid
                        inRange = true;
                    }
                }

                if(inRange==true) {
                    // This object is within this grid
                    addThis(rocketOrShip, i, j, id);
                } else {
                    // This object is NOT within this grid
                    removeThis(rocketOrShip, i, j, id);
                }
            }
        }
    }

    var addThis = function(rocketOrShip, i, j, id) {
        // Inform gridObject of the change. It will decide to add (if it doesn't exist)
        var added;
        if(rocketOrShip=="ship") {
            // Subscribe the ship to the grid
            // Won't get added if it already exists inside
            added = addThisShip(i, j, id);            
        } else if(rocketOrShip=="rocket") {
            // Subscribe the rocket to the grid
            // Won't get added if it already exists inside
            added = addThisRocket(i, j, id);
        }

        if(added==true) {
            //Rocket or ship joined the grid
            console.log(rocketOrShip+" "+id+" has moved into grid "+grid[i][j].gridID);
            var i,j;
            for(i in grid) for(j in grid[i]) grid[i][j].printShipMembers();
        }
    }

    var addThisShip = function(i, j, id) {
        var added = grid[i][j].addShip(id);
        var k;

        if(added==true) {
            // Inform other players in the grid that this new ship entered said grid
            broadcastInGridUnless({
                type: "new", 
                id: id, 
                x: ships[id].x,
                y: ships[id].y,
                dir: ships[id].dir
            }, i, j, id);

            // Inform THIS new ship of other objects within the joined grid
            for(k in grid[i][j].ships) {
                if(k!=id && ships[k]!=undefined) unicast(sockets[id], {
                    type:"new",
                    id: k,
                    x: ships[k].x, 
                    y: ships[k].y, 
                    dir: ships[k].dir
                });
            }

            for(k in grid[i][j].rockets) {
                unicast(sockets[id], {
                    type:"fire",
                    ship: rockets[k].from,
                    rocket: k,
                    x: rockets[k].x,
                    y: rockets[k].y,
                    dir: rockets[k].dir
                });
            }
        } 

        return added;
    }

    var addThisRocket = function(i, j, id) {
        var added = grid[i][j].addRocket(id);

        if(added==true) {
            // Inform other players in the grid that this rocket entered said grid
            broadcastInGridUnless({
                type:"fire",
                ship: rockets[id].from,
                rocket: id,
                x: rockets[id].x,
                y: rockets[id].y,
                dir: rockets[id].dir
            }, i, j, id);   
        }

        return added;
    }

    var removeThis = function(rocketOrShip, i, j, id) {
        // Inform gridObject of the change. It will decide to remove (if it exists)
        var removed;

        if(rocketOrShip=="ship") { // Subscribe the ship to the grid
            removed = grid[i][j].removeShip(id);
        } else if(rocketOrShip=="rocket") { // Subscribe the rocket to the grid
            removed = grid[i][j].removeRocket(id);
        }

        if(removed==true) {
            console.log(rocketOrShip+" "+id+" has exited grid "+grid[i][j].gridID);
            var i,j;
            for(i in grid) for(j in grid[i]) grid[i][j].printShipMembers();

            if(rocketOrShip=="ship") {
                // Inform other players this ship has left the grid
                broadcastInGridUnless({
                    type: "delete", 
                    id: id
                }, i, j, id);

                var k;
                // Inform THIS exiting ship that the other ships "vanished"
                console.log("checking gridID="+grid[i][j].gridID+", i="+i+", j="+j);
                for(k in grid[i][j].ships) {
                    if(k!=id) {
                        console.log("deleting "+k+" from grid");
                        unicast(sockets[id], {
                        type: "delete", 
                        id: k});
                    }
                }
            }

            // No need to inform other players of rockets leaving the zone.
            // The rocket will naturally travel to the end of the map and despawn.
        }
    }

    /*
     * priviledge method: start()
     *
     * Called when the server starts running.  Open the
     * socket and listen for connections.  Also initialize
     * callbacks for socket.
     */
    this.start = function () {
        try {
            initGrid();

            var express = require('express');
            var http = require('http');
            var sockjs = require('sockjs');
            var sock = sockjs.createServer();

            // Upon connection established from a client socket
            sock.on('connection', function (conn) {
                newPlayer(conn);

                // When the client closes the connection to the 
                // server/closes the window
                conn.on('close', function () {
                    var pid = players[conn.id].pid;
                    var i,j;

                    console.log("player "+pid+" has left the game.");

                    for(i in grid) for(j in grid[i]) {
                        // Delete this ship from other grids
                        if(grid[i][j].removeShip(pid)==true) { // If this ship belongs in this grid
                            console.log("player "+pid+" has left grid "+grid[i][j].gridID);                            
                            // Inform other players this ship has left the grid
                            broadcastInGridUnless({
                                type: "delete", 
                                id: pid
                            }, i, j, pid);
                        }
                    }

                    delete ships[pid];
                    delete players[conn.id];
                    console.log("Finished informing everyone player "+pid+" has left the game.");
                });

                // When the client send something to the server.
                conn.on('data', function (data) {
                    var message = JSON.parse(data)
                    var p = players[conn.id];
                    if (p === undefined) {
                        // we received data from a connection with
                        // no corresponding player.  don't do anything.
                        console.log("player at " + conn.id + " is invalid."); 
                        return;
                    } 
                    switch (message.type) {
                        case "join":
                            // A client has requested to join. 
                            // Initialize a ship at random position
                            // and tell everyone.
                            var pid = players[conn.id].pid;
                            var x = Math.floor(Math.random()*Config.WIDTH);
                            var y = Math.floor(Math.random()*Config.HEIGHT);
                            var dir;
                            var dice = Math.random();
                            // pick a dir with equal probability
                            if (dice < 0.25) {
                                dir = "right";
                            } else if (dice < 0.5) {
                                dir = "left";
                            } else if (dice < 0.75) {
                                dir = "up";
                            } else {
                                dir = "down";
                            }

                            ships[pid] = new Ship();
                            ships[pid].init(x, y, dir);

                            // Informs all players except this new guy
                            // This step is irrelevant because we now rely on grids to tell us
                            /*broadcastUnless({
                                type: "new", 
                                id: pid, 
                                x: x,
                                y: y,
                                dir: dir}, pid)*/

                            // Unitcast to this new guy
                            unicast(sockets[pid], {
                                type: "join",
                                id: pid,
                                x: x,
                                y: y,
                                dir: dir});   
                            
                            // Tell this new guy who else is in the game.
                            // This step is irrelevant. New guy will instead pull info from the grids when he joins them
                            // New player will automatically join a new grid on his first move
                            /*for (var i in ships) {
                                if (i != pid) {
                                    if (ships[i] !== undefined) {
                                        unicast(sockets[pid], {
                                            type:"new",
                                            id: i, 
                                            x: ships[i].x, 
                                            y: ships[i].y, 
                                            dir: ships[i].dir});   
                                    }
                                }
                            }*/
                            
                            break;
                        case "turn":
                            // A player has turned.  Tell everyone else.
                            var pid = players[conn.id].pid;
                            ships[pid].jumpTo(message.x, message.y);
                            ships[pid].turn(message.dir);
                            /*broadcastUnless({
                                type:"turn",
                                id: pid,
                                x: message.x, 
                                y: message.y, 
                                dir: message.dir
                            }, pid);*/

                            var i, j;
                            for(i in grid) for(j in grid[i]) {
                                //console.log("i="+i+", j="+j+", grid[i][j].isShipInGrid(pid)="+grid[i][j].isShipInGrid(pid));
                                if(grid[i][j].isShipInGrid(pid)==true) {
                                    broadcastInGridUnless({
                                        type:"turn",
                                        id: pid,
                                        x: message.x,
                                        y: message.y,
                                        dir: message.dir
                                    }, i, j, pid);
                                }
                            }                            

                            break;
                        case "fire":
                            // A player has asked to fire a rocket.  Create
                            // a rocket, and tell everyone (including the player, 
                            // so that it knows the rocket ID).
                            var pid = players[conn.id].pid;
                            var r = new Rocket();
                            r.init(message.x, message.y, message.dir, pid);
                            var rocketId = new Date().getTime();
                            rockets[rocketId] = r;
                            /* rockets joining grids will take care of this
                            broadcast({
                                type:"fire",
                                ship: pid,
                                rocket: rocketId,
                                x: message.x,
                                y: message.y,
                                dir: message.dir
                            });*/
                            break;
                            
                        default:
                            console.log("Unhandled " + message.type);
                    }
                }); // conn.on("data"
            }); // socket.on("connection"

            // cal the game loop
            setInterval(function() {gameLoop();}, 1000/Config.FRAME_RATE); 

            // Standard code to start the server and listen
            // for connection
            var app = express();
            var httpServer = http.createServer(app);
            sock.installHandlers(httpServer, {prefix:'/space'});
            httpServer.listen(Config.PORT, Config.SERVER_NAME);
            app.use(express.static(__dirname));
            console.log("Server running on http://" + Config.SERVER_NAME + 
                    ":" + Config.PORT + "\n")
            console.log("Visit http://" + Config.SERVER_NAME + ":" + Config.PORT + "/index.html in your browser to start the game")
        } catch (e) {
            console.log("Cannot listen to " + Config.PORT);
            console.log("Error: " + e);
        }
    }
}

// This will auto run after this script is loaded
var server = new MMOServer();
server.start();

// vim:ts=4:sw=4:expandtab
