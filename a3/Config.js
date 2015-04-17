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

	RENDER_GRID_LINES : true,
	NO_OF_GRIDS : 4,
	GRID_LENGTH : 500,
	GRID_HEIGHT : 350,

	RENDER_AOI_LINES : true,
	RENDER_AOI : false,
	AOI_LENGTH : 100,
	AOI_HEIGHT : 100
}


// For node.js require
global.Config = Config;

// vim:ts=4
