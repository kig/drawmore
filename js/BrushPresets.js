DefaultPalette = [
	[255,255,255],
	[192,192,192],
	[148,148,148],
	[128,128,128],
	[96,96,96],
	[64,64,64],
	[32,32,32],
	[0,0,0]
];

Curves = {
	one : [0, 1, 0, 1, 1, 1, 1, 1],

	linear: [0, 0, 0, 0, 1, 1, 1, 1],
	linear15: [0, 0, 0, 0, 0.65, 1, 0.65, 1],

	linerRadius: [0, 0.33, 0, 1, 0.75, 1, 1, 1],

	pencilOpacity: [0, 0, 0.9, 0.0, 1, 1, 1, 1],
	pencilRadius: [0, 0.5, 0, 0.65, 0.8, 1, 1, 1],

	wateryRadius: [0, 0.1, 0, 0.1, 1, 1, 1, 1],
	wateryOpacity: [0, 0, 0, 1, 0, 1, 1, 0.1]
};

CurvePresets = {
	brush: {
		radius: Curves.linear.slice(),
		opacity: Curves.linear15.slice()
	},

	liner: {
		radius: Curves.linerRadius.slice(),
		opacity: Curves.one.slice()
	},

	pencil: {
		radius: Curves.pencilRadius.slice(),
		opacity: Curves.pencilOpacity.slice()
	},

	watery: {
		radius: Curves.wateryRadius.slice(),
		opacity: Curves.wateryOpacity.slice()
	}
};

BrushPresets = {
	"Felt Pen": {
		curve: CurvePresets.liner,
		r: 3,
		texture: 1
	},

	"Pencil": {
		curve: CurvePresets.pencil,
		r: 2,
		texture: 3
	},

	"Brush": {
		curve: CurvePresets.brush,
		texture: 0
	},

	"Liner": {
		curve: CurvePresets.liner
	},
	
	"Inkish": {
		curve: CurvePresets.watery,
		texture: 3
	}
};
