let tracks = [];
let selected = null;
let heldkey = null;
let username = null;
let nameInput = "";
let leaderboardPos = null
let leaderboardData = [];
let state, pstate;
let clicked = false;
let releasedkey = null;
let started = false;
let tooltipdata = null;
let trackscroll = 0;
let playtime, freeze, counter;
let u, cx, cy, bx;
let keymap = { 'a':0, 's':1, 'k':2, 'l':3 };
let hitwindow = 300;
let hitmarker = [0,0,0,0];
let judgement = null;
let judgementtime = 0;
let combo = 0;
let maxcombo = 0;
let colors;
let scrollspeed = 0.0007;
let volume = 0.7;
let bg = 1;

function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);
  textFont('Inter');
  rectMode(CENTER);
  strokeCap(SQUARE);
  colors = [
    bg<1 ? lerpColor(color(255), color('#FF8289'), bg) : lerpColor(color('#FF8289'), color(0), bg-1),
    bg<1 ? lerpColor(color(255), color('#FF9A00'), bg) : lerpColor(color('#FF9A00'), color(0), bg-1),
    bg<1 ? lerpColor(color(255), color('#72DB5A'), bg) : lerpColor(color('#72DB5A'), color(0), bg-1),
    bg<1 ? lerpColor(color(255), color('#00E4C2'), bg) : lerpColor(color('#00E4C2'), color(0), bg-1),
  ];
  state = "menu";
  windowResized();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  u = height*0.01;
  cy = height*0.5;
  cx = width*0.5;
  bx = width*0.1;
  textSize(u*2);
}

function draw() {
  switch(state) {
    case "menu": menu(); break;
    case "playing": play(); break;
    case "paused": pause(); break;
    case "settings": settings(); break;
    case "loading": loading(); break;
    case "countdown": countdown(); break;
    case "postgame": postgame(); break;
    case "leaderboard": leaderboard(); break;
  }
  if(tooltipdata) {
    button(tooltipdata.label, tooltipdata.x, tooltipdata.y, tooltipdata.w, tooltipdata.h);
    tooltipdata = null;
  }
  clicked = false;
  releasedkey = null;
}

function loadinit() {
  state = "loading";
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.bleh,.blehs';
  input.onchange = e => setTimeout(() => loadprocess(e.target.files[0]), 0);
  input.oncancel = () => state = "menu";
  input.click();
}

async function loadprocess(file) {
  if(!file) { state = "menu"; return; }
  const bin = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(bin);
  if(file.name.endsWith('.blehs')) {
    const files = Object.values(zip.files).filter(f => !f.dir);
    await Promise.all(files.map(async f => {
      await loadfile(await JSZip.loadAsync(await f.async('arraybuffer')));
    }));
  } else {
    await loadfile(zip);
  }
  state = "menu";
}

async function loadfile(zip) {
  const charttxt = await zip.file('blehchart').async('string');
  const imgbin = await zip.file('blehimg').async('blob');
  const trackbin = await zip.file('blehtrack').async('blob');
  const imgurl = URL.createObjectURL(imgbin);
  const trackurl = URL.createObjectURL(trackbin);
  const chart = parse(charttxt);
  const img = await new Promise((resolve, reject) => loadImage(imgurl, resolve, reject));
  const track = await new Promise((resolve, reject) => loadSound(trackurl, resolve, reject));
  tracks.push({chart, charttxt, img, track});
  if(selected === null) selected = 0;
}

function parse(text) {
  const [head, body] = text.split('---');
  const meta = {};
  for(const line of head.split('\n').filter(l => l.trim())) {
    const [type, val] = line.split(":").map(s => s.trim());
    meta[type] = val;
  }
  const notes = body.split('\n').filter(l => l.trim()).map(l => {
    const [askl, time] = l.split(':');
    return { askl: parseInt(askl), time: parseInt(time), hit: null };
  });
  return {meta, notes};
}

async function submitScore() {
  const { acc } = stats(tracks[selected]);
  const trackident = tracks[selected].chart.meta.title + tracks[selected].chart.meta.artist;
  await fetch('/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trackident, username: nameInput, score: acc, date: Date.now() })
  });
  const res = await fetch('/leaderboard/' + trackident);
  const scores = await res.json();
  leaderboardPos = scores.findIndex(s => s.username === nameInput && s.score === acc) + 1;
  username = nameInput;
}

function loading() {
  button("...", cx, height*0.85, u*14, u*4.5);
}

function play() {
  if(freeze && playtime==0) freeze = false;
  else playtime = tracks[selected].track.isPlaying() || tracks[selected].track.isPaused() ? tracks[selected].track.currentTime()*1000 : 0;

  const { acc, rating, finished } = stats(tracks[selected]);
  if(finished) { tracks[selected].track.stop(); leaderboardPos = null; username = null; nameInput = ""; state = "postgame"; }

  image(tracks[selected].img, 0, 0, width, height);
  background(bg>=1 ? 255 : 0, bg>=1 ? (bg-1)*255 : (1-bg)*255);
  ui(acc, rating);

  for(const note of tracks[selected].chart.notes) {
    if(note.hit === null && playtime-note.time > hitwindow*0.5) {
      note.hit = "miss";
      judgement = "miss";
      combo = 0;
      judgementtime = millis();
    }
    const y = cy+35*u-(note.time-playtime)*scrollspeed*height;
    if(y < -u*3 || y > height+u*3) continue;
    if(note.hit == null) drawnote(false, note.askl, y);
    else if(note.hit == "miss") drawnote(true, note.askl, y);
  }
}

function pause() {
  play();
  const options = [
    (x,y) => { if(button("r[e]sume", x, y, u*14, u*4.5, 'e')) { state = "countdown"; } },
    (x,y) => { if(button("[r]estart", x, y, u*14, u*4.5, 'r')) { started = false; combo = 0; maxcombo = 0; tracks[selected].track.stop(); tracks[selected].chart = parse(tracks[selected].charttxt); state = "countdown"; } },
    (x,y) => { if(button("[s]ettings", x, y, u*14, u*4.5, 's')) { pstate = "paused"; state = "settings"; } },
    (x,y) => { if(button("[q]uit", x, y, u*14, u*4.5, 'q')) { started = false; tracks[selected].track.stop(); leaderboardPos = null; username = null; nameInput = ""; state = "postgame"; } },
  ];
  for(let i=0; i<options.length; i++) {
    const x = bx;
    const y = cy-((options.length-1)*u*5*0.5)+(i*u*5);
    options[i](x, y);
  }
}

function countdown() {
  play();
  if(counter == null) counter = millis();
  button(3-floor((millis()-counter)*0.0015), cx, cy, u*14, u*4.5);
  if(millis() > counter+2000) {
    counter = null;
    tracks[selected].track.setVolume(volume);
    tracks[selected].track.play();
    started = true;
    freeze = true;
    state = "playing";
  }
}

function postgame() {
  background(0);
  const { acc, rating, finished } = stats(tracks[selected]);
  if(finished && username === null) {
    button(nameInput.length>0?nameInput:"[enter name]",cx,cy,u*20,u*4.5);
    return;
  }
  const hits = tracks[selected].chart.notes.filter(n => n.hit !== null && n.hit !== "miss");
  const bias = hits.length ? hits.reduce((sum, n) => sum + n.hit, 0) / hits.length : 0;
  const statsx = width-bx-u*21;
  button(!finished ? "cancelled!" : "finished!", statsx-u*21, cy-u*21.5, u*14, u*4.5,!finished ? "no score submitted" : "score submitted");
  button(nf(acc*100,1,1)+"%", statsx+u*16, cy-u*21.5, u*14, u*4.5, "accuracy");
  button(rating, statsx+u*25.75, cy-u*21.5, u*4.5, u*4.5, "rating");
  trackbutton(tracks[selected], statsx, cy-u*14.25, u*56, u*9, selected,"title\nartist","track length");
  button("", statsx, cy+u*4.75, u*56, u*28, "accuracy graph");
  accuracygraph(statsx, cy+u*4.75, u*56, u*28);
  button(maxcombo+"x", statsx-u*23.375, cy+u*21.5, u*9.25, u*4.5, "max combo");
  button(nf(bias,1,1)+"ms", statsx-u*13.625, cy+u*21.5, u*9.25, u*4.5, "input bias");
  button(leaderboardPos ? "#"+leaderboardPos : "-", statsx+u*21, cy+u*21.5, u*14, u*4.5, "leaderboard pos");

  const options = [
    (x,y) => { if(button("[r]eplay", x, y, u*14, u*4.5, 'r')) { started = false; combo = 0; maxcombo = 0; tracks[selected].chart = parse(tracks[selected].charttxt); state = "countdown"; } },
    (x,y) => { if(button("[t]op list",x,y,u*14, u*4.5,'t') && selected !== null) { pstate="postgame"; state="leaderboard"; } },
    (x,y) => { if(button("[q]uit", x, y, u*14, u*4.5, 'q')) { started = false; combo = 0; maxcombo = 0; tracks[selected].chart = parse(tracks[selected].charttxt); state = "menu"; } },
  ];
  for(let i=0; i<options.length; i++) {
    const x = bx;
    const y = cy-((options.length-1)*u*5*0.5)+(i*u*5);
    options[i](x, y);
  }
}

function menu() {
  background(0);
  fill(255); noStroke();
  textSize(height*0.1);
  textAlign(LEFT, CENTER);
  text("bleh4k", bx-u*7, height/3);
  textSize(height*0.02);
  textAlign(CENTER, CENTER);

  if(tracks.length == 0) {
    button("no charts imported! ):", width-bx-u*21, cy, u*56, u*9);
  } 
  else {
    for(let i=0; i<tracks.length; i++) {
      const x = width-bx-u*21;
      const y = cy-((tracks.length-1)*u*4.75)+(i*u*9.5)+trackscroll;
      if(trackbutton(tracks[i], x, y, u*56, u*9, i)) selected = i;
    }
  }
  
  const options = [
    (x,y) => { if(button("pl[a]y", x, y, u*14, u*4.5, 'a') && selected !== null) { state = "countdown"; } },
    (x,y) => { if(button("[t]op list",x,y,u*14, u*4.5,'t') && selected !== null) { pstate="menu"; state="leaderboard"; } },
    (x,y) => { if(button("impo[r]t", x, y, u*14, u*4.5, 'r')) setTimeout(loadinit, 0); },
    (x,y) => { if(button("[s]ettings", x, y, u*14, u*4.5, 's')) { pstate="menu"; state="settings"; } },
  ];
  for(let i=0; i<options.length; i++) {
    const x = bx;
    const y = cy-((options.length-1)*u*5*0.5)+(i*u*5);
    options[i](x, y);
  }
}

function leaderboard() {
  background(0);
  fill(255); noStroke();
  textSize(height*0.1);
  textAlign(LEFT, CENTER);
  text("toplist", bx-u*7, height/3);
  textSize(height*0.02);
  textAlign(CENTER, CENTER);

  if(leaderboardData.length == 0) {
    button("no scores logged! ):", width-bx-u*21, cy, u*56, u*9);
  } 
  else {
    for(let i=0; i<leaderboardData.length; i++) {
      const x = width-bx-u*21;
      const y = cy-((leaderboardData.length-1)*u*4.75)+(i*u*9.5)+trackscroll;
      button("#"+(i+1)+" "+leaderboardData[i].username+"  "+nf(leaderboardData[i].score*100,1,1)+"%", x, y, u*56, u*4.5);
    }
  }
  
  if(button("pl[a]y", bx, cy-u*2.5, u*14, u*4.5, 'a')) { state = "countdown"; };
  if(button("[b]ack", bx, cy+u*2.5, u*14, u*4.5, 'b')) { state = pstate; };
}

async function fetchLeaderboard() {
  const trackident = tracks[selected].chart.meta.title + tracks[selected].chart.meta.artist;
  const res = await fetch('/leaderboard/' + trackident);
  leaderboardData = await res.json();
}

function settings() {
  colors = [
    bg<1 ? lerpColor(color(255), color('#FF8289'), bg) : lerpColor(color('#FF8289'), color(0), bg-1),
    bg<1 ? lerpColor(color(255), color('#FF9A00'), bg) : lerpColor(color('#FF9A00'), color(0), bg-1),
    bg<1 ? lerpColor(color(255), color('#72DB5A'), bg) : lerpColor(color('#72DB5A'), color(0), bg-1),
    bg<1 ? lerpColor(color(255), color('#00E4C2'), bg) : lerpColor(color('#00E4C2'), color(0), bg-1),
  ];
  if(pstate === "menu") {
    background(0);
    fill(255); noStroke();
    textSize(height*0.1);
    textAlign(LEFT, CENTER);
    text("settings", bx-u*7, height/3);
    textSize(height*0.02);
    textAlign(CENTER, CENTER);
  }
  else play();

  const options = [
    (x,y) => { scrollspeed = slider("[s]peed", x, y, u*14, u*4.5, scrollspeed, 0.0002, 0.002, v => nf(v*1000,1,1), 0.0001, 's'); },
    (x,y) => { volume = slider("[v]olume", x, y, u*14, u*4.5, volume, 0, 1, v => nf(v,1,1), 0.1, 'v'); },
    (x,y) => { bg = slider("sc[e]ne", x, y, u*14, u*4.5, bg, 0, 2, v => nf(v,1,1), 0.1, 'e'); },
    (x,y) => { if(button("[b]ack", x, y, u*14, u*4.5, 'b')) state = pstate; },
  ];
  for(let i=0; i<options.length; i++) {
    const x = bx;
    const y = cy-((options.length-1)*u*5*0.5)+(i*u*5);
    options[i](x, y);
  }
}

function keyPressed() {
  if(state === "postgame" && username === null && stats(tracks[selected]).finished) {
    if(key === "Backspace") nameInput = nameInput.slice(0, -1);
    else if(key === "Enter" && nameInput.length > 0) submitScore();
    else if(key.length === 1) nameInput += key;
    return;
  }
  if(key === 'Escape') {
    switch(state) {
      case "playing": tracks[selected].track.pause(); state = "paused"; break;
      case "countdown": counter = null; state = "paused"; break;
      case "paused": state = "countdown"; break;
      case "settings": state = pstate; break;
      case "menu": pstate = "menu"; state = "settings"; break;
      case "postgame" && username!==null: started = false; combo = 0; maxcombo = 0; tracks[selected].chart = parse(tracks[selected].charttxt); state = "menu";
    };
  }
  if(state === "playing") {
    const giveninput = keymap[key];
    if(giveninput === undefined) return;
    hitmarker[giveninput] = 1;
    for(const note of tracks[selected].chart.notes) {
      if(note.hit !== null) continue;
      if(note.askl !== giveninput) continue;
      const hittime = playtime-note.time;
      if(abs(hittime) < hitwindow*0.5) {
        note.hit = hittime;
        judgement = getjudgement(hittime).label;
        judgementtime = millis();
        combo++;
        if(combo > maxcombo) maxcombo = combo;
        break;
      }
    }
    return;
  }
  heldkey = key;
}

function keyReleased() {
  const giveninput = keymap[key];
  if(giveninput !== undefined) hitmarker[giveninput] = 0;
  if(heldkey !== key) return;
  heldkey = null;
  releasedkey = key;
  
  if(state === "menu") {
    if(keyCode === UP_ARROW && selected > 0) { selected--; scrolltoselected(); }
    if(keyCode === DOWN_ARROW && selected < tracks.length-1) { selected++; scrolltoselected(); }
    if(keyCode === ENTER && selected !== null) { state = "countdown"; }
  }

  if(state === "leaderboard") {
    if(keyCode === UP_ARROW) trackscroll += u*9.5;
    if(keyCode === DOWN_ARROW) trackscroll -= u*9.5;
  }
}

function mouseReleased() { clicked = true; }

function mouseWheel(event) {
  if(state === "menu" || state === "leaderboard") {
    trackscroll -= event.delta*0.75;
    const edge = (state === "leaderboard" ? leaderboardData.length : tracks.length - 1)*u*4.75;
    trackscroll = constrain(trackscroll, -edge, edge);
  }
}

function scrolltoselected() {
  const y = cy-((tracks.length-1)*u*4.75)+(selected*u*9.5)+trackscroll;
  if(y < u*14) trackscroll += (u*14-y);
  if(y > height-u*14) trackscroll -= (y-(height-u*14));
  trackscroll = constrain(trackscroll, -(tracks.length-1)*u*4.75, (tracks.length-1)*u*4.75);
}

function drawnote(missed, column, y) {
  noFill();
  stroke(colors[column]);
  strokeWeight(u*3*0.46);
  circle(cx-u*8*1.5+column*u*8, y, u*3*1.54);
}

function ui(acc, rating) {
  const remaining = tracks[selected].track.duration()-tracks[selected].track.currentTime();
  const mins = floor(remaining/60);
  const secs = floor(remaining%60);
  noStroke();
  for(let i=0; i<4; i++) {
    fill(colors[i]);
    circle(cx-u*8*1.5+i*u*8, cy+35*u, u*3*(1.2+hitmarker[i]*0.3));
  }
  if(judgement && millis()-judgementtime < 1000) button(judgement, cx, cy, u*14, u*4.5);
  button(nf(acc*100,1,1)+"%", width-bx-u*12, u*15, u*14, u*4.5, "accuracy");
  button(rating, width-bx-u*2.25, u*15, u*4.5, u*4.5, "rating");
  button(mins+":"+nf(secs,2), width-bx-u*7, u*20, u*14, u*4.5, "remaining time");
  button(combo+"x", cx, u*15, u*14, u*4.5, "combo");
}

function accuracygraph(x, y, w, h) {
  for(const note of tracks[selected].chart.notes) {
    if(note.hit === null) continue;
    const nx = map(note.time, 0, tracks[selected].track.duration()*1000, x-w*0.5, x+w*0.5);
    const ny = note.hit === "miss" ? y : map(note.hit, -hitwindow*0.5, hitwindow*0.5, y-h*0.45, y+h*0.45);
    if(note.hit === "miss") {
      stroke(255); strokeWeight(u*0.1*0.5);
      line(nx, y-0.5*h, nx, y+0.5*h);
    } else {
      noStroke(); fill(255);
      circle(nx, ny, u*0.1*4);
    }
  }
  noFill();
  stroke(255); strokeWeight(u*0.1);
  rect(x, y, w, h);
  strokeWeight(u*0.1*0.5);
  line(x-0.5*w, y, x+0.5*w, y);
}

function stats(track) {
  const jud = track.chart.notes.filter(n => n.hit !== null);
  const acc = jud.length ? jud.reduce((sum, n) => sum + getjudgement(n.hit).value, 0) / (jud.length*400) : 0;
  const finished = started && !track.track.isPlaying() && !track.track.isPaused();
  return {acc, rating: getrating(acc), finished};
}

function getjudgement(hit) {
  if(hit === "miss") return {label: "miss", value: 0};
  const t = abs(hit);
  if(t < hitwindow*0.08) return {label: "perfect!", value: 400};
  if(t < hitwindow*0.15) return {label: "good", value: 300};
  if(t < hitwindow*0.3) return {label: "okay", value: 200};
  if(t < hitwindow*0.5) return {label: "bad", value: 100};
  return {label: "miss", value: 0};
}

function getrating(acc) {
  if(acc >= 0.98) return "S+";
  if(acc >= 0.90) return "S";
  if(acc >= 0.80) return "A";
  if(acc >= 0.70) return "B";
  if(acc >= 0.60) return "C";
  if(acc >= 0.50) return "D";
  return "F";
}

function button(label, x, y, w, h, string) {
  const hovered = (abs(mouseX-x)<w*0.5 && abs(mouseY-y)<h*0.5) || (string && string.length===1 && heldkey===string);
  const active = string && string.length===1 && hovered && (mouseIsPressed || heldkey===string);
  fill(0); noStroke();
  rect(x, y, w+u*0.75, h+u*0.75);
  stroke(255); strokeWeight(u*0.1);
  fill(active ? 255 : 0); rect(x, y, w, h);
  fill(active ? 0 : 255); noStroke();
  text(label, x, y);
  if(string && string.length!=1 && hovered) {
    const tw = textWidth(string) + u*4.5;
    const to = tw*0.5+u*0.375;
    const th = u*4.5+2*u*(string.split("\n").length-1);
    tooltipdata = {label: string, x: constrain(mouseX+to, to, width-to), y: mouseY+th*0.5+u*0.375, w: tw, h: th};
  }
  return (clicked && hovered || releasedkey === string) && string && string.length===1;
}

function trackbutton(track, x, y, w, h, i, string1, string2) {
  const hoveredleft = mouseX<x&&abs(mouseX-x)<w*0.5 && abs(mouseY-y)<h*0.5;
  const hoveredright = mouseX>x&&abs(mouseX-x)<w*0.5 && abs(mouseY-y)<h*0.5;
  const secs = floor(track.track.duration()%60);
  const mins = floor(track.track.duration()/60);
  fill(0); noStroke();
  rect(x, y, w+u*0.75, h+u*0.75);
  stroke(255); strokeWeight(u*0.1);
  fill((hoveredleft||hoveredright)&&(mouseIsPressed||clicked) || i==selected ? 255 : 0);
  rect(x, y, w, h);
  fill((hoveredleft||hoveredright)&&(mouseIsPressed||clicked) || i==selected ? 0 : 255);
  noStroke();
  textAlign(LEFT, CENTER);
  text(track.chart.meta.title+"\n"+track.chart.meta.artist, x-w*0.46, y);
  textAlign(RIGHT, CENTER);
  text(mins+"min "+secs+"sec", x+w*0.46, y);
  textAlign(CENTER, CENTER);
  if(string2 && hoveredleft) {
    const tw = textWidth(string1) + u*4.5;
    const to = tw*0.5+u*0.375;
    const th = u*4.5+2*u*(string1.split("\n").length-1);
    tooltipdata = {label: string1, x: constrain(mouseX+to, to, width-to), y: mouseY+th*0.5+u*0.375, w: tw, h: th};
  }
  else if(string1 && (string2 ? hoveredright : (hoveredleft||hoveredright))) {
    const tw = textWidth(string2) + u*4.5;
    const to = tw*0.5+u*0.375;
    const th = u*4.5+2*u*(string2.split("\n").length-1);
    tooltipdata = {label: string2, x: constrain(mouseX+to, to, width-to), y: mouseY+th*0.5+u*0.375, w: tw, h: th};
  }
  return clicked && (hoveredleft||hoveredright);
}

function slider(label, x, y, w, h, val, min, max, format, step, string) {
  const t = (val-min)/(max-min);
  const lx = x-w*0.5+t*w;
  fill(0); noStroke();
  rect(x, y, w+u*0.75, h+u*0.75);
  stroke(255); strokeWeight(u*0.1);
  fill(0); rect(x, y, w, h);
  stroke(255); strokeWeight(u*0.1*1.5);
  line(lx, y-h*0.5, lx, y+h*0.5);
  fill(255); noStroke();
  text("  "+label+": "+format(val)+"  ", x, y);
  if(releasedkey === string && step !== undefined) {
    return round(val+step, 4) > max ? min : round(val+step, 4);
  }
  if(mouseIsPressed && abs(mouseX-x)<w*0.5 && abs(mouseY-y)<h*0.5) {
    return lerp(min, max, constrain((mouseX-(x-w*0.5))/w, 0, 1));
  }
  return val;
}