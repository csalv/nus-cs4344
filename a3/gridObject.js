"use stritct";

function gridObject(gid, xPos, yPos) {
	var that = this;

	this.ships = {};
	this.rockets = {};

	this.gridID = gid;
	this.topLeftX = xPos; // The x-coord of the top left-hand corner of this grid
	this.topLeftY = yPos; // The y-coord of the top left-hand corner of this grid
	this.addShip = function(id) {
	// If ship already exists in array, don't add; just return
		var i;
		for(i in that.ships) if(i==id) return false;

		that.ships[id] = 1;
		return true;
	}

	this.removeShip = function(id) {
	// If ship exists in array, kill it
		var i;
		for(i in that.ships) {
			if(i==id) {
				that.ships[i] == null;
				delete that.ships[i];
				return true;
			}  else {
				// Do nothing
				return false;	
			}
		}	
	}

	this.isShipInGrid = function(id) {
	// If ship already exists in array, return true
		var i;
		for(i in that.ships) if(i==id) return true;
		return false;	
	}

	this.addRocket = function(id) {
	// If rocket already exists in array, don't add; just return
		var i;
		for(i in that.rockets) if(i==id) return false;

		that.rockets[id] = 1;
		return true;
	}

	this.removeRocket = function(id) {
	// If rocket exists in array, kill it
		var i;
		for(i in that.rockets) {
			if(i==id) {
				that.rockets[i] == null;
				delete that.rockets[i];
				return true;
			} else {
				// Do nothing
				return false;	
			}
		}
	}

	this.isRocketInGrid = function(id) {
	// If ship already exists in array, return true
		var i;
		for(i in that.rockets) if(i==id) return true;
		return false;	
	}

	this.printShipMembers = function() {
		var i, msg;
		msg = "gridID="+that.gridID+", {"
		for(i in that.ships) {
			msg += i+", "
		}

		msg += "}";
		console.log(msg);
	}
}

global.gridObject = gridObject;