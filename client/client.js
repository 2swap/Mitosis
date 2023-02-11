var socket = io('alexhontz.com', {path: '/pps/io'});

var canvas = document.getElementById('ctx');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var ctx = canvas.getContext("2d");






var keyboard = {};
var typing = false;
var chatLength = 30, chatScroll = 0, globalChat = 0, preChatArr = {}, chati = 0;
var messages = {};
for (var i = 0; i < chatLength; i++)
	messages[i] = "";
var tick = 0;

var mpx = 0, mpy = 0; // mouse pixel coords
var lastMouse = 5;

var ops = 0;
var didW = false;
var empty = 0;
var multiplayer = true;

var w = window.innerWidth;
var h = window.innerHeight; // Canvas width and height
var cells = 0;
var viruses = 0;
var prokaryotes = 0;
var pellets = 0;

var myID = 0;
var lx = 0, ly = 0;//center of screen
var zoomMult = 1, towardsZoom = 1;
var mapSz = 2048;


var virusColors = ["red","blue","green","yellow"];
var basePairs = ['A','T','G','C'];


var Img = {}
loadAllImages();


socket.emit('requestBody');


function loadImage (name, src) {
	if (Img[name]) {console.error("Loading image twice: " + name); return;}
	Img[name] = new Image();
	Img[name].src = src;
}
function loadAllImages(){
	loadImage("redvirus", '/mitosis/img/redvirus.png');
	loadImage("bluevirus", '/mitosis/img/bluevirus.png');
	loadImage("greenvirus", '/mitosis/img/greenvirus.png');
	loadImage("yellowvirus", '/mitosis/img/yellowvirus.png');
	loadImage("cilia", '/mitosis/img/cilia.png');
	loadImage("meta", '/mitosis/img/meta.png');
	loadImage("ana", '/mitosis/img/ana.png');
}



function render(){
	if(empty == 0 || ops > 0)
		return;
	tick++;
	ctx.globalAlpha = 1;
	ctx.fillStyle = "#00c0f0";
	ctx.fillRect(0,0,w,h);
	zoomMult = (zoomMult*3+towardsZoom)/4;
	
	
	frames++;
	ops++;
	
	//objects
	ctx.save();
	ctx.font = "12px Telegrama";
	ctx.textAlign = "center";
	ctx.globalAlpha = .75;
	ctx.translate(w/2, h/2);
	ctx.scale(zoomMult, zoomMult);
	ctx.translate(-w/2, -h/2);
	rGrid();
	rWall();
	rPellets();
	rViruses();
	rProkaryotes();
	rCells();
	ctx.restore();
	
	if(globalTimer == -149)
	towardsZoom = 1;
	
	//gui
	rChat();
	rLB();
	rTimer();
	ops--;
}


//packet handling
socket.on('posUp', function (data) {
	cells = data.cells;
	prokaryotes = data.prokaryotes;
	if(data.viruses !== 0) viruses = data.viruses;
	if(data.pellets !== 0) pellets = data.pellets;
	empty = 1;
	globalTimer = data.globalTimer;
	if(lastMouse-- < 0){
		lastMouse = 3;
		sendMouse(mpx,mpy);
	}
});
socket.on('chat', function (data) {
	for (var i = chatLength; i > 0; i--)
		messages[i] = messages[i - 1];
	messages[0] = data.msg;
});
socket.on('id',function(data){
	myID = data.id;
});
socket.on('newGame',function(data){
	socket.emit('requestBody');
	towardsZoom = 1;
});

setInterval(function(){
	let d = new Date();
	var time = d.getTime();
	socket.emit('pingmsg', {time:time});
},1000);
setInterval(function(){
	w = window.innerWidth;
	h = window.innerHeight;
	if(canvas.width != w || canvas.height != h){
		canvas.width = w;
		canvas.height = h;
	}
},40);
setInterval(function(){
	render();
},20);


//input
document.onkeydown = function (event) {
	if(keyboard[event.keyCode] == true)
		return;
	keyboard[event.keyCode] = true;
	if (event.keyCode === 83 || event.keyCode === 40)//s
		socket.emit('key', { inputId: 's', state: true });
	else if (event.keyCode === 32)//space
		socket.emit('split', {});
}
document.onkeyup = function (event) {
	if(keyboard[event.keyCode] == false)
		return;
	keyboard[event.keyCode] = false;
	if (event.keyCode === 83 || event.keyCode === 40)//s
		socket.emit('key', { inputId: 's', state: false });
	else if (event.keyCode === 87 || event.keyCode === 38)//w
		socket.emit('key', { inputId: 'w', state: false });
	else if (event.keyCode === 65 || event.keyCode === 37)//a
		socket.emit('key', { inputId: 'a', state: false });
	else if (event.keyCode === 68 || event.keyCode === 39)//d
		socket.emit('key', { inputId: 'd', state: false });
	else if (event.keyCode === 32)//space
		socket.emit('key', { inputId: ' ', state: false });
	else if (event.keyCode === 16)
		shift = false;
}

document.addEventListener('mousewheel', function (evt) {
	towardsZoom *= 1+.2*Math.sign(evt.wheelDelta);
}, false);
document.addEventListener('mousemove', function (evt) {
	var mousePos = getMousePos(canvas, evt);
	mpx = mousePos.x, mpy = mousePos.y;
});
function getMousePos(canvas, evt) {
	var rect = canvas.getBoundingClientRect();
	return {
		x: evt.clientX - rect.left,
		y: evt.clientY - rect.top
	};
}
function sendMouse(mx, my){
	var mx = lx + (mpx-w/2)/zoomMult;
	var my = ly + (mpy-h/2)/zoomMult;
	socket.emit("mouse", {x:mx, y:my});
}



//random
function write(str, x, y){
	ctx.fillText(str, x, y);
}
function square(x){
	return x * x;
}
function cube(x){
	return x * x * x;
}
function lerp(a,b,w){
	return a * (1 - w) + b * w;
}
function coherentNoise (x){
	var intX = Math.floor(x);
	var w = x - intX;
	var n0 = Math.sin(square(intX)*1000);
	var n1 = Math.sin(square(intX+1)*1000);
	return n0+(n1-n0)*(w*w/2-w*w*w/3)*6;
}
function currTime(){
	return new Date().getTime();
}


function rChat(){
	ctx.textAlign = "left";
	ctx.font = "11px Telegrama";
	
	ctx.fillStyle = "black";
	for (var i = 0; i < 100; i++){
		ctx.globalAlpha = (19-i)/20;
		write(messages[i],16,h-32-12*i);
	}
	ctx.globalAlpha = 1;
}
function rLB(){
	
	ctx.fillStyle = 'yellow';
	ctx.font = "24px Telegrama";
	ctx.textAlign = "center";
	write("Leaderboard", w - 128, 28);
	ctx.font = "11px Telegrama";
	ctx.fillStyle = 'yellow';
	write("Name", w - 208, 48);
	ctx.textAlign = "right";
	write("Mass", w - 48 - 16, 48);
	var lb = [];
	var masses = {};
	for(var i in cells){
		if(typeof masses[cells[i].name] == "undefined")masses[cells[i].name]=cells[i].mass;
		else masses[cells[i].name] += cells[i].mass;
	}
	while(Object.keys(masses).length>0){
		var bestIndex = 0;
		for(var i in masses){
			console.log(masses[i]);
			if(bestIndex == 0)
				bestIndex = i;
			if(masses[i] > masses[bestIndex])
				bestIndex = i;
		}
		lb.push({name:bestIndex, mass:Math.floor(masses[bestIndex])});
		delete masses[bestIndex];
	}
	for(var i = 0; i < lb.length; i++){
		ctx.font = "11px Telegrama";
		var place = 1 + i;
		ctx.fillStyle = lb[i].finished?"lime":"yellow";
		ctx.textAlign = "left";
		write(lb[i].name, w - 216, (i+4)*16);
		ctx.fillStyle = 'yellow';
		write(place + ".", w - 248, (i+4)*16);
		ctx.textAlign = "right";
		write(lb[i].mass, w-80, (i+4)*16)
	}
}
function rTimer(){
	if(globalTimer < 48) {
		ctx.textAlign = "center";
		ctx.font = "128px Telegrama";
		ctx.fillStyle=["lime", "yellow","orange","red"][Math.floor((globalTimer-49)/-50)];
		write(globalTimer<0?(""+(Math.floor(globalTimer/-50)+1)):"GO!",w/2,h-64);
	}
}
function splat(x,y,r,i){
	ctx.save();
	ctx.translate(x,y);
	ctx.beginPath();
	for(var a = 0; a < 2*Math.PI; a+=2./r){
		var currR = r;
		currR += Math.sin(2*a + 5*(coherentNoise(currTime() / 900. + i)))/2;
		currR += Math.sin(3*a + 5*(coherentNoise(currTime() / 500. + i)))/2;
		currR += Math.sin(4*a + 5*(coherentNoise(currTime() / 800. + i)))/2;
		currR += Math.sin(5*a + 5*(coherentNoise(currTime() / 600. + i)))/2;
		ctx.lineTo(currR*Math.cos(a),currR*Math.sin(a))
	}
	ctx.closePath();
	ctx.globalAlpha /= 3;
	ctx.fill();
	ctx.globalAlpha *= 3;
	ctx.stroke();
	ctx.restore();
}
function circle(x,y,r){
	ctx.save();
	ctx.translate(x,y);
	ctx.beginPath();
	ctx.arc(0,0,r,0,2*Math.PI);
	ctx.closePath();
	ctx.globalAlpha /= 3;
	ctx.fill();
	ctx.globalAlpha *= 3;
	ctx.stroke();
	ctx.restore();
}
function longCircle(x,y,r,angle){
	ctx.save();
	ctx.translate(x,y);
	ctx.rotate(angle);
	ctx.beginPath();
	for(var a = 0; a < 2*Math.PI; a+=.05){
		var xx = 3*Math.cos(a);
		var yy = 3*Math.sin(a);
		xx+=(Math.abs(a-Math.PI)>Math.PI/2?1:-1)*r*Math.cos(0);
		ctx.lineTo(xx,yy);
	}
	ctx.closePath();
	ctx.globalAlpha /= 3;
	ctx.fill();
	ctx.globalAlpha *= 3;
	ctx.stroke();
	ctx.restore();
}


function rPellets(){
	ctx.lineWidth = 3;
	for (var i in pellets) {
		var selfo = pellets[i];
		var rendX = selfo.x - lx + w/2;
		var rendY = selfo.y - ly + h/2;
		ctx.fillStyle = ctx.strokeStyle = selfo.letter < 4? "white":"lime";

		if(selfo.letter < 4)
			write(basePairs[selfo.letter],rendX,rendY);
		else
			circle(rendX, rendY, 4);
	}
}
function rWall(){
	ctx.lineWidth = 8;
	var selfo = pellets[i];
	var rendX = mapSz/2 - lx + w/2;
	var rendY = mapSz/2 - ly + h/2;
	ctx.fillStyle = ctx.strokeStyle = "black";
	circle(rendX, rendY, mapSz/2);
}
function rGrid(){
	ctx.strokeStyle = "grey";
	ctx.lineWidth = .2;
	for(var x = 0; x <= mapSz; x+=32){
		ctx.beginPath();
		ctx.moveTo(x-lx+w/2,0-ly+h/2);
		ctx.lineTo(x-lx+w/2,mapSz-ly+h/2);
		ctx.closePath();
		ctx.stroke();
	}
	for(var y = 0; y <= mapSz; y+=32){
		ctx.beginPath();
		ctx.moveTo(0-lx+w/2,y-ly+h/2);
		ctx.lineTo(mapSz-lx+w/2,y-ly+h/2);
		ctx.closePath();
		ctx.stroke();
	}
}
function rCells(){
	ctx.lineWidth = 3;
	var nlx = 0, nly = 0;
	var myMass = .001;
	
	for (var i in cells) {
		var selfo = cells[i];
		
		var rendX = selfo.x - lx + w/2;
		var rendY = selfo.y - ly + h/2;
		
		var r = Math.sqrt(selfo.mass);
		ctx.fillStyle = ctx.strokeStyle = (selfo.ownerID == myID && selfo.goalString.length == selfo.currString.length)?"lime":"cyan";
		if(selfo.infection != -1) ctx.fillStyle = ctx.strokeStyle = virusColors[selfo.infection];
		
		splat(rendX, rendY, r, i*999);
		
		ctx.globalAlpha /= 2;
		for(var col = 0; col < 4; col++)
			if((selfo.immunity & (1 << col)) != 0){
				ctx.fillStyle = ctx.strokeStyle = virusColors[col];
				circle(rendX + r/2*((col==1?1:0)-(col==3?1:0)), rendY + r/2*((col==2?1:0)-(col==0?1:0)), r/8);
			}
		ctx.globalAlpha *= 2;
		
		//name
		ctx.fillStyle = "white";
		ctx.font = (r/3)+"px Telegrama";
		write(selfo.name, rendX, rendY - 6 - (r/2));
		
		if(selfo.ownerID == myID){
			if(selfo.goalString.length == selfo.currString.length){
				var mx = lx + (mpx-w/2)/zoomMult;
				var my = ly + (mpy-h/2)/zoomMult;
				var angle = Math.atan2(my-selfo.y, mx-selfo.x);
				var img = Img.meta;
				ctx.save();
				ctx.translate(rendX, rendY);
				ctx.rotate(angle);
				ctx.drawImage(img,.75*-img.width/2,.75*-img.height/2, img.width*.75, img.height*.75);
				ctx.restore();
			}
			if(selfo.age < 25 && globalTimer > 30){
				var mx = lx + (mpx-w/2)/zoomMult;
				var my = ly + (mpy-h/2)/zoomMult;
				var angle = Math.atan2(my-selfo.y, mx-selfo.x);
				var img = Img.ana;
				ctx.save();
				ctx.globalAlpha = .75*(25-selfo.age)/25;
				ctx.translate(rendX, rendY);
				ctx.rotate(angle);
				ctx.drawImage(img,.75*-img.width/2,.75*-img.height/2, img.width*.75, img.height*.75);
				ctx.restore();
			}
		}
		
		if(selfo.ownerID == myID){
			ctx.font = (r/2)+"px Telegrama";
			nlx += selfo.mass * selfo.x;
			nly += selfo.mass * selfo.y;
			myMass += selfo.mass;
			
			if(selfo.goalString.length != selfo.currString.length){
				ctx.fillStyle = "black";
				write(selfo.goalString, rendX, rendY - 2);
				write(selfo.currString, rendX, rendY + 2 + (r/2));
			}
		}
	}
	lx = nlx/myMass;
	ly = nly/myMass;
	if(Object.keys(cells).length < 2){
		lx = ly = mapSz/2;
		towardsZoom = .3;
	}
}
function rViruses(){
	ctx.lineWidth = 3;
	for (var i in viruses) {
		ctx.save();
		var selfo = viruses[i];
		var rendX = selfo.x - lx + w/2;
		var rendY = selfo.y - ly + h/2;
		ctx.fillStyle = ctx.strokeStyle = selfo.color;
		var img = Img.yellowvirus;
		if(selfo.color === "red")
			img = Img.redvirus;
		if(selfo.color === "blue")
			img = Img.bluevirus;
		if(selfo.color === "green")
			img = Img.greenvirus;
		ctx.translate(rendX,rendY);
		ctx.rotate(i*Math.PI*2);
		ctx.drawImage(img, -img.width/8,-img.height/8, img.width/4,img.height/4);
		ctx.restore();
	}
}
function rProkaryotes(){
	ctx.lineWidth = 3;
	var nlx = 0, nly = 0;
	var myMass = 0;
	
	for (var i in prokaryotes) {
		var selfo = prokaryotes[i];
		var rendX = selfo.x - lx + w/2;
		var rendY = selfo.y - ly + h/2;
		ctx.fillStyle = ctx.strokeStyle = "black";

		longCircle(rendX, rendY, selfo.size, (selfo.angle + Math.PI * 2000) % (2*Math.PI));
		
		ctx.save();
		ctx.translate(rendX-(selfo.size+6)*Math.cos(selfo.angle), rendY-(selfo.size+6)*Math.sin(selfo.angle))
		ctx.rotate(selfo.angle + Math.PI / 2);
		ctx.drawImage(Img.cilia, 0,(tick+Math.floor(i*4))%4*24, 16,24, -4, -6, 8,12);
		ctx.restore();
	}
}

