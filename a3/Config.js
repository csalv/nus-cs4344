/*=====================================================
  Declared as literal object (All variables are static)	  
  =====================================================*/
var Config = {
	HEIGHT : 700,				// height of game window
	WIDTH : 1000,				// width of game window
	PORT : 4344,				// port of game
	FRAME_RATE : 40,			// frame rate 
	SERVER_NAME : "localhost",	// server name of game
	//SERVER_NAME : "172.28.176.122"	// server name of game

	RENDER_GRID_LINES : true,	// Toggles on/off the box that shows the grids on the map
	NO_OF_GRIDS : 4,			// Most of the settings for the grids are almost hardcoded,
								// so changing this might mess other stuff up
	GRID_LENGTH : 500,
	GRID_HEIGHT : 350,

	RENDER_AOI_LINES : true, 	// Toggles on/off the box that shows a ship's AOI
	RENDER_AOI : false,			// Toggles on/off rendering of ships/rockets outside of AOI
								// False = Don't render things outside of AOI
								// True = render things outside of AOI and within subscribed grids
	AOI_LENGTH : 100,			// AOI Size
	AOI_HEIGHT : 100 			// AOI Size
}


// For node.js require
global.Config = Config;

// vim:ts=4
