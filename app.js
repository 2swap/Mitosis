var express = require('express');
var app = express();
const socketio = require('socket.io');

var port = 10004;

console.log('Server started');
console.log('Enabling express...');
app.use('/mitosis',express.static(__dirname + '/client'));
console.log("Express started on port " + port);
var server = app.listen(port);
const io = socketio.listen(server, {"path":"/mitosis/io"})

var players = {};
var sockets = {};
var viruses = {};
var prokaryotes = {};
var pellets = {};

var virusColors = ["red","blue","green","yellow"];
var basePairs = ['A','T','G','C'];

var globalTimer = -175, newGameCountDown = 0, lag = 0, ops = 0;
var springiness = 1;
var speedMult = .1;
var mapSz = 2048;
var dnaLength = 4;


var Player = function(i){
	var self = {
		name:("Guest"+Math.random()*1000000).substring(0,9),
		pingTimer:500,
		cellCount:0,
		cells:{},
		immunity:0,
		id:i,
		mx:0,
		my:0
	}
	self.tick = function(){
		if(self.cellCount < 1)
			delete players[self.id];
		if(self.pingTimer--<0 && self.id != Math.PI){
			var text = self.name + " disconnected!";
			sendAll("chat", {msg:text});
			delete players[self.id];
			return;
		}
		if(globalTimer < 0 || self.dead)
			return;
		self.move();
	}
	self.move = function(){
		for(var i in self.cells) self.cells[i].move();
		self.collide();
		self.collideWall();
		self.collideInternal();
	}
	self.collide = function(){
		for(var p in players){
			var player = players[p];
			if(player.id < self.id)
				for(var c in self.cells) for(var e in player.cells) self.cells[c].collide(player.cells[e]);
		}
	}
	self.collideWall = function(){
		for(var i in self.cells){
			var c = self.cells[i];
			var dist = hypot2(mapSz/2,c.x,mapSz/2,c.y);
			if(dist > square(mapSz/2)){
				var dx = mapSz/2-c.x, dy = mapSz/2-c.y
				c.x -= mapSz/2;
				c.y -= mapSz/2;
				c.x *= square(mapSz/2)/dist;
				c.y *= square(mapSz/2)/dist;
				c.x += mapSz/2;
				c.y += mapSz/2;
			}
		}
	}
	self.collideInternal = function(){
		for(var i in self.cells){
			var c = self.cells[i];
			for(var j in self.cells)
				if(i < j){
					var c2 = self.cells[j]
					var cr = Math.sqrt(c.mass), c2r = Math.sqrt(c2.mass);
					var properDist = cr+c2r;
					var dist = Math.sqrt(hypot2(c.x,c2.x,c.y,c2.y));
					var big = Math.max(cr,c2r), small = Math.min(cr,c2r);
					
					if(c.age > 1200 && c2.age > 1200){
						if(dist < ((big+small)+2*(big-small))/3){
							if(c.mass>c2.mass)c2.die(c);
							else c.die(c2);
						}
						continue;
					}
					if(c.age < 25 || c2.age < 25) continue;
					var ageMult = Math.min(1,Math.min(c.age,c2.age)/100);
					if(dist < properDist){
						var px = c.x, py = c.y;
						c.x -= c2.x;
						c.y -= c2.y;
						c.x *= ageMult*properDist/dist;
						c.y *= ageMult*properDist/dist;
						c.x += c2.x;
						c.y += c2.y;
						c2.x -= px;
						c2.y -= py;
						c2.x *= ageMult* properDist/dist;
						c2.y *= ageMult*properDist/dist;
						c2.x += px;
						c2.y += py;
					}
				}
		}
	}
	self.split = function(){
		var ids = {};
		var ct = 0;
		for(var i in self.cells){
			ids[i] = 0;
			ct++;
		}
		while(ct > 0 && self.cellCount < 16){
			var topID = 0;
			for(var i in ids)
				if(topID == 0 || self.cells[i].mass > self.cells[topID].mass)
					topID = i;
			self.cells[topID].split()
			delete ids[topID];
			ct--;
		}
	}
	self.changeName = function(newName){
		if(newName.length > 16 || pass.length < 1){
			send(self.id, "chat", {msg:"Name must be 1-16 characters."});
			return;
		}
		self.name = newName;
		self.save();
		send(self.id, "chat", {msg:"Name changed successfully."});
	}
	self.sendMap = function(){
		send(self.id, "chat", {msg:"New map loaded."});
		send(self.id, "newMap", {rings:rings});
	}
	self.respawn = function(){
		self.dead = false;
	}
	self.sendID = function(){
		send(self.id,"id",{id:self.id});
	}
	self.die = function(){
		self.dead = true;
	}
	return self;
}

var Cell = function(i, x, y, m, ownerID){
	var self = {
		name:players[ownerID].name,
		id:i,
		ownerID:ownerID,
		x:x,
		y:y,
		vx:0,
		vy:0,
		age:0,
		mass:m,
		infection:-1,
		infectionTimer:0,
		goalString:randDNA(),
		currString: ""
	}
	self.infect = function(strain){
		self.infection = strain;
	}
	self.move = function(){
		if(self.infection!=-1) self.tickInfection();
		self.mass *= .99995;
		self.x += self.vx;
		self.y += self.vy;
		self.vx *= .9;
		self.vy *= .9;
		self.age++;
		var dx=players[ownerID].mx-self.x, dy=players[ownerID].my-self.y;
		var mag2 = square(dx)+square(dy);
		if(mag2 == 0)
			return;
		var mag = Math.sqrt(mag2 * Math.sqrt(self.mass))*.08;//fast inverse square root! :D
		if(mag2 < self.mass)
			mag*=self.mass/mag2;
		if(self.age == 1 && players[self.ownerID].cellCount > 1){
			self.vx = 10*dx/mag;
			self.vy = 10*dy/mag;
		}
		self.vx += .1*dx/mag;
		self.vy += .1*dy/mag;
	}
	self.tickInfection = function(){
		self.infectionTimer++;
		if(Math.random() > .9){
			var id = Math.random();
			var v = Virus(id);
			var angle = Math.random() * Math.PI * 2;
			var r = 2 * Math.random() + 2;
			v.strain = self.infection;
			v.vx = Math.cos(angle)*r;
			v.vy = Math.sin(angle)*r;
			v.x = self.x + v.vx * 1.1 * Math.sqrt(self.mass);
			v.y = self.y + v.vy * 1.1 * Math.sqrt(self.mass);
			viruses[id] = v;
		}
		if(self.infectionTimer>125)
			self.die(0);
	}
	self.collide = function(enemy){
		var sr = Math.sqrt(self.mass), er = Math.sqrt(enemy.mass);
		var big = Math.max(sr,er), small = Math.min(sr,er);
		var dist = Math.sqrt(hypot2(self.x,enemy.x,self.y,enemy.y));
		if(dist < ((big+small)+2*(big-small))/3){
			var diff = self.mass / enemy.mass;
			if(diff > 1.28)
				enemy.die(self);
			else if(diff < 1/1.28)
				self.die(enemy);
		}
	}
	self.append = function(letter){
		if(self.currString.length == dnaLength)return;
		var answer = self.goalString.charAt(self.currString.length);
		var correct = false;
		if(answer === "T" && letter === "A") correct = true;
		if(answer === "A" && letter === "T") correct = true;
		if(answer === "G" && letter === "C") correct = true;
		if(answer === "C" && letter === "G") correct = true;
		if(correct) self.currString += letter;
		else self.currString = "";
	}
	self.split = function(){
		if(self.currString.length != dnaLength) return false;
		var p = players[self.ownerID];
		p.cellCount++;
		var id = Math.random();
		p.cells[id] = Cell(id, self.x, self.y, self.mass/2, self.ownerID);
		self.mass/=2;
		self.age = 1;
		p.cells[id].move();
		self.currString = "";
		self.goalString = randDNA();
	} 
	self.computeRadius = function(){
		self.r = Math.sqrt(self.mass);
	}
	self.die = function(enemy){
		players[self.ownerID].cellCount--;
		if(enemy !== 0) enemy.mass += self.mass;
		if(self.infection != -1)
			for(var i = 0; i < 8; i++){
				var id = Math.random();
				var v = Virus(id);
				var angle = Math.random() * Math.PI * 2;
				var r = Math.random() * 2 + 2;
				v.strain = self.infection;
				v.vx = Math.cos(angle)*r;
				v.vy = Math.sin(angle)*r;
				v.x = self.x;
				v.y = self.y;
				viruses[id] = v;
			}
		delete players[ownerID].cells[self.id];
	}
	return self;
}

var Virus = function(i){
	var self = {
		id:i,
		strain:Math.floor(4*Math.random()),
		vx:0,
		vy:0,
		x:rxy(),
		y:rxy(),
		color:0
	}
	self.die = function(){
		spawnVirus();
		delete viruses[self.id];
	}
	self.tick = function(){
		if(self.color === 0) self.color = virusColors[self.strain];
		self.playerCollision();
		self.x += self.vx;
		self.y += self.vy;
		self.vx *= .99;
		self.vy *= .99;
	}
	self.playerCollision = function(){
		for(var i in players){
			var p = players[i];
			for(var j in p.cells){
				var c = p.cells[j];
				var dist2 = hypot2(self.x,c.x,self.y,c.y);
				if(dist2 < c.mass){
					self.die();
					c.mass += 16;
					if((p.immunity & (1 << self.strain)) != 0)
						return;
					p.immunity+=1<<self.strain;
					c.infect(self.strain);
					return;
				}
			}
		}
	}
	return self;
}

var Pellet = function(i){
	var self = {
		id:i,
		letter:Math.floor(Math.random()*16),
		x:rxy(),
		y:rxy()
	}
	self.die = function(){
		spawnPellet();
		delete pellets[self.id];
	}
	self.tick = function(){
		self.playerCollision();
	}
	self.playerCollision = function(){
		for(var i in players){
			var p = players[i];
			for(var j in p.cells){
				var c = p.cells[j];
				var dist2 = hypot2(self.x,c.x,self.y,c.y);
				if(dist2 < c.mass){
					if(self.letter > 3) c.mass += 12;
					else c.append(basePairs[self.letter]);
					self.die();
					return;
				}
			}
		}
	}
	return self;
}

var Prokaryote = function(i){
	var self = {
		id:i,
		angle:Math.random()*Math.PI*2,
		va:0,
		x:rxy(),
		y:rxy(),
		size:Math.random()*10+5
	}
	self.move = function(mx, my){
		self.va += (Math.random()-.5)/100;
		self.va *= .97;
		self.angle += self.va;
		self.x += Math.cos(self.angle);
		self.y += Math.sin(self.angle);
	}
	self.collideWall = function(){
		var dist = hypot2(mapSz/2,self.x,mapSz/2,self.y);
		if(dist > square(mapSz/2)){
			var dx = mapSz/2-self.x, dy = mapSz/2-self.y;
			self.x -= mapSz/2;
			self.y -= mapSz/2;
			self.x *= square(mapSz/2)/dist;
			self.y *= square(mapSz/2)/dist;
			self.x += mapSz/2;
			self.y += mapSz/2;
		}
	}
	self.die = function(){
		spawnProkaryote();
		delete prokaryotes[self.id];
	}
	self.tick = function(){
		self.move();
		self.playerCollision();
		self.collideWall();
	}
	self.playerCollision = function(){
		for(var i in players){
			var p = players[i];
			for(var j in p.cells){
				var c = p.cells[j];
				var dist2 = hypot2(self.x,c.x,self.y,c.y);
				if(dist2 < c.mass){
					c.mass += self.size*3;
					self.die();
					return;
				}
			}
		}
	}
	return self;
}



function send(id, msg, data){
	var s = sockets[id];
	if(typeof s !== "undefined")
		s.emit(msg, data);
}



io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	sockets[socket.id]=socket;
	
	socket.on('requestBody',function(data){
		if(typeof players[socket.id] !== "undefined")
			return;
		var player = Player(socket.id);
		players[socket.id]=player;
		player.cellCount++;
		//give em a cell
		var cid = Math.random();
		player.cells[cid] = Cell(cid, rxy(), rxy(), 512, player.id);
		while(hypot2(mapSz/2,player.cells[cid].x,mapSz/2,player.cells[cid].y)>square(mapSz/2)){player.cells[cid].x = rxy(); player.cells[cid].y = rxy();}
		
		player.sendID();
	});
	socket.on('pingmsg',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined") return;
		player.pingTimer = 250;
	});
	socket.on('disconnect',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined") return;
		var text = player.name + " left the game!";
		sendAll("chat", {msg:text});
	});
	socket.on('split',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined") return;
		player.split();
	});
	socket.on('chat',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined" || typeof data.msg !== "string") return;
		data.msg = data.msg.trim();
		if(typeof data.msg !== 'string' || data.msg.length == 0 || data.msg.length > 128) return;
		data.msg = (" "+data.msg+" ").replace(/fuck/ig, '****').replace(/fuk/ig, '****').replace(/vagina/ig, '******').replace(/fvck/ig, '****').replace(/penis/ig, '*****').replace(/slut/ig, '****').replace(/ tit /ig, ' *** ').replace(/ tits /ig, ' **** ').replace(/whore/ig, '****').replace(/shit/ig, '****').replace(/cunt/ig, '****').replace(/bitch/ig, '*****').replace(/faggot/ig, '******').replace(/ fag /ig, ' *** ').replace(/nigger/ig, '******').replace(/nigga/ig, '******').replace(/dick/ig, '****').replace(/ ass /ig, ' *** ').replace(/pussy/ig, '*****').replace(/ cock /ig, ' **** ').trim();
		var spaces = "";
		for(var i = player.name.length; i < 16; i++)
			spaces += " ";
			
		const finalMsg = (player.name + ": " + data.msg);
		if(player.globalChat == 0)
			sendAll('chat', {msg:finalMsg});
	});
	socket.on('mouse',function(data){
		var player = players[socket.id];
		if(typeof player === "undefined") return;
		player.mx = data.x;
		player.my = data.y;
	});
});



function rxy(){
	return Math.random() * mapSz;
}
function square(x){
	return x * x;
}
function abs(x){
	return x > 0?x:-x;
}
function mod(n, m) {
    var remain = n % m;
    return Math.floor(remain >= 0 ? remain : remain + m);
}
function r128(){
	return Math.floor(Math.random() * 128);
}
function hypot2(x1, x2, y1, y2){
	return square(x1-x2)+square(y1-y2);
}
function randRainbow(){
	var t = r128();
	var str = ((Math.floor(Math.cos(t) * 128 + 128) << 16) + (Math.floor(Math.cos(t+Math.PI*2/3) * 128 + 128) << 8) + Math.floor(Math.cos(t+Math.PI * 4 / 3) * 128 + 128)).toString(16);
	while (str.length < 6)
		str = "0"+str;
	return "#"+str;
}
function randDNA(){
	var str = "";
	for(var i = 0; i < dnaLength; i++)
		str += basePairs[Math.floor(4*Math.random())];
	return str;
}




function sendAll(out, data){
	for(var i in sockets)
		sockets[i].emit(out, data);
}

function spawnProkaryote(){
	var id = Math.random();
	var p = Prokaryote(id);
	prokaryotes[id] = p;
	while(hypot2(mapSz/2,p.x,mapSz/2,p.y)>square(mapSz/2)){p.x = rxy(); p.y = rxy();}
}
function spawnPellet(){
	var id = Math.random();
	var p = Pellet(id);
	pellets[id] = p;
	while(hypot2(mapSz/2,p.x,mapSz/2,p.y)>square(mapSz/2)){p.x = rxy(); p.y = rxy();}
}
function spawnVirus(){
	var id = Math.random();
	var v = Virus(id);
	viruses[id] = v;
	while(hypot2(mapSz/2,v.x,mapSz/2,v.y)>square(mapSz/2)){v.x = rxy(); v.y = rxy();}
}


newGame();
setTimeout(update,3000);
function newGame(){

	viruses = {};
	prokaryotes = {};
	pellets = {};
	players = {};

	sendAll("newGame", {});
	
	var piPlayer = Player(Math.PI);
	piPlayer.mx = piPlayer.my = (mapSz/2);
	piPlayer.cellCount++;
	players[Math.PI] = piPlayer;
	var cid = Math.random();
	piPlayer.cells[cid] = Cell(cid, mapSz/2, mapSz/2, 512, Math.PI);
	
	globalTimer = -150;
	
	
	for(var i = 0; i < 30; i++){
		spawnVirus();
		spawnProkaryote();
		for(var j = 0; j < 10; j++)
			spawnPellet();
	}
	
	for(var i in players)
		players[i].sendID();
	
}



function update(){
	ops++;
	
	if(ops < 2)
		setTimeout(update, 20);
		
	globalTimer++;
		
	var mod2 = globalTimer % 2 == 0;
	var mod4 = globalTimer % 4 == 0;
	
	var cellPack = {};
	var playersAlive = 0;
	for(var i in players){
		var p = players[i];
		if(!p.dead)
			playersAlive++;
		p.tick();
		if(!p.dead) for(var j in p.cells){
			var c = p.cells[j];
			cellPack[c.id] = {age:c.age, infection:c.infection, immunity:p.immunity, goalString:c.goalString, currString:c.currString, name:c.name, ownerID:c.ownerID, x:c.x, y:c.y, mass:c.mass};
		}
	}
	
	if(playersAlive < 2){
		for(var i in players){
			var p = players[i];
			if(!p.dead && newGameCountDown == 0)
				sendAll("chat",{msg:p.name+" won the round!"});
		}
		if(newGameCountDown == 0)
			newGameCountDown = 100;
		newGameCountDown--;
		if(newGameCountDown == 0)
			newGame();
	}
	
	var prokaryotePack = {};
	for(var i in prokaryotes){
		var p = prokaryotes[i];
		p.tick();
		prokaryotePack[p.id] = {x:p.x, y:p.y, angle:p.angle, size:p.size};
	}
	
	var virusPack = mod2?{}:0;
	for(var i in viruses){
		var v = viruses[i];
		v.tick();
		if(mod2) virusPack[v.id] = {x:v.x, y:v.y, color:v.color};
	}
	
	var pelletPack = mod4?{}:0;
	for(var i in pellets){
		var p = pellets[i];
		p.tick();
		if(mod4) pelletPack[p.id] = {x:p.x, y:p.y, letter:p.letter};
	}
	
	sendAll('posUp', {cells:cellPack, prokaryotes:prokaryotePack, viruses:virusPack, pellets:pelletPack, globalTimer:globalTimer});
	
	ops--;
}
