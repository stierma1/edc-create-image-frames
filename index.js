"use strict"

var Worker = require("basic-distributed-computation").Worker;
var VirtualFrame = require("virtual-frames-edc");

var scaleMatch = /_scale\/{([1-9](\.[0-9][0-9]?[0-9]?)?)}/;
var rotateMatch = /_rotate\/{([0-9](\.[0-9][0-9]?[0-9]?)?)}/;
var shiftXMatch = /_shift_x\/{([1-9][0-9]*)}/;
var shiftYMatch = /_shift_y\/{([1-9][0-9]*)}/;
var minXMatch = /_min_x\/{([1-9][0-9]*)}/;
var minYMatch = /_min_y\/{([1-9][0-9]*)}/;
var resizeToMin = /_resize_to_min\/{true}/;
var heightMatch = /_height\/{([1-9][0-9]*)}/;
var widthMatch = /_width\/{([1-9][0-9]*)}/;

class CreateFrames extends Worker {
  constructor(parent){
    super("create-image-frames", parent);
  }

  work(req, inputKey, outputKey){
    var inputVal = req.body;
    if(inputKey){
        inputVal = req.body[inputKey];
    }
    var currentPath = req.paths[req.currentIdx];
    var scale = scaleMatch.exec(currentPath);
    scale = scale ? parseFloat(scale[1]) : 2;
    if(inputVal.scale){
        scale = inputVal.scale;
    }
    var rotate = rotateMatch.exec(currentPath);
    rotate = rotate ? parseFloat(rotate[1]) : 0;
    if(inputVal.rotate){
        rotate = inputVal.rotate;
    }
    var shiftX = shiftXMatch.exec(currentPath);
    shiftX = shiftX ? parseInt(shiftX[1]) : 1;
    if(inputVal.shiftX){
        shiftX = inputVal.shiftX;
    }
    var shiftY = shiftYMatch.exec(currentPath);
    shiftY = shiftY ? parseInt(shiftY[1]) : 1;
    if(inputVal.shiftY){
        shiftY = inputVal.shiftY;
    }
    var minX = minXMatch.exec(currentPath);
    minX = minX ? parseInt(minX[1]) : 32;
    if(inputVal.minX){
        minX = inputVal.minX;
    }
    var minY = minYMatch.exec(currentPath);
    minY = minY ? parseInt(minY[1]) : 32;
    if(inputVal.minY){
        minY = inputVal.minY;
    }
    var resize = resizeToMin.exec(currentPath);
    resize = resize ? true : false;
    if(inputVal.resize){
        resize = inputVal.resize;
    }
    var height = heightMatch.exec(currentPath);
    height = height ? parseInt(height) : 1;
    if(inputVal.height){
        height = inputVal.height;
    }
    var width = widthMatch.exec(currentPath);
    width = width ? pathInt(width) : false;
    if(inputVal.width){
        width = inputVal.width;
    }
    var frames = [];

    var initFrame = new VirtualFrame(width, height, 0, 0, minX, minY, resize);
    var newFrame = initFrame;
    var curScale = 1;

    while(newFrame){
      newFrame = newFrame.scale(curScale);
      if(newFrame){
        frames.push(newFrame);
      }
      var downFrame = newFrame;
      while(downFrame){
        var rightFrame = downFrame;
        while(rightFrame){
          rightFrame = rightFrame.shiftX(shiftX);
          if(rightFrame){
            frames.push(rightFrame);
          }
        }
        downFrame = downFrame.shiftY(shiftY);
        if(downFrame){
          frames.push(downFrame);
        }
      }

      curScale *= scale;
    }
    if(outputKey){
      req.body[outputKey] = frames;
    } else {
      req.body = frames;
    }
    req.next();
  }
}

module.exports = CreateFrames;
