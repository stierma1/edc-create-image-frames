"use strict"

var Worker = require("basic-distributed-computation").Worker;
var Jimp = require("jimp");

var scaleMatch = /_scale\/{([1-9](\.[0-9][0-9]?[0-9]?)?)}/;
var rotateMatch = /_rotate\/{([0-9](\.[0-9][0-9]?[0-9]?)?)}/;
var shiftXMatch = /_shift_x\/{([1-9][0-9]*)}/;
var shiftYMatch = /_shift_y\/{([1-9][0-9]*)}/;
var minXMatch = /_min_x\/{([1-9][0-9]*)}/;
var minYMatch = /_min_y\/{([1-9][0-9]*)}/;
var resizeToMin = /_resize_to_min\/{true}/

class VirtualFrame {
  constructor(maxX, maxY, xOffset, yOffset, width, height, minX, minY, resize){
    this.maxX = maxX;
    this.maxY = maxY;
    this.xOffset = xOffset;
    this.yOffset = yOffset;
    this.width = width;
    this.height = height;
    this.minX = minX;
    this.minY = minY;
    this.resize = resize;
  }

  shiftX(shiftDistance){
    if(this.maxX > this.xOffset + this.width + shiftDistance){
      return new VirtualFrame(this.maxX, this.maxY, this.xOffset + shiftDistance, this.yOffset, this.width, this.height, this.minX, this.minY, this.resize);
    } else {
      return null;
    }
  }

  shiftY(shiftDistance){
    if(this.maxY > this.yOffset + this.height + shiftDistance){
      return new VirtualFrame(this.maxX, this.maxY, this.xOffset, this.yOffset + shiftDistance, this.width, this.height, this.minX, this.minY, this.resize);
    } else {
      return null;
    }
  }

  scale(factor){
    if(this.maxY > this.yOffset + this.height*factor && this.maxX > this.xOffset + this.width*factor){
      return new VirtualFrame(this.maxX, this.maxY, this.xOffset, this.yOffset, Math.floor(this.width * factor), Math.floor(this.height * factor), this.minX, this.minY, this.resize);
    } else {
      return null;
    }
  }

  makeConcrete(image, resize){
    return new Promise( (resolve, reject) => {
      var img = image.crop(this.xOffset, this.yOffset, this.width, this.height)
      if(this.resize){
        img = img.resize(this.minX, this.minY)
      }
        img.quality(75)
        .getBuffer(Jimp.MIME_JPEG, (err, buff) => {
          resolve({
            image:buff,
            frameData: this
          });
        });
    });
  }
}

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
    var rotate = rotateMatch.exec(currentPath);
    rotate = rotate ? parseFloat(rotate[1]) : 0;
    var shiftX = shiftXMatch.exec(currentPath);
    shiftX = shiftX ? parseInt(shiftX[1]) : 1;
    var shiftY = shiftYMatch.exec(currentPath);
    shiftY = shiftY ? parseInt(shiftY[1]) : 1;
    var minX = minXMatch.exec(currentPath);
    minX = minX ? parseInt(minX[1]) : 32;
    var minY = minYMatch.exec(currentPath);
    minY = minY ? parseInt(minY[1]) : 32
    var resize = resizeToMin.exec(currentPath);
    resize = resize ? true : false;

    Jimp.read(inputVal).then((image) => {
      var height = image.bitmap.height;
      var width = image.bitmap.width;
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
      return Promise.all(
        frames.map((frame) => {
          return frame.makeConcrete(image, resize, minX, minY);
        })
      );
    }).then((frames) => {
      if(outputKey){
        req.body[outputKey] = frames;
      } else {
        req.body = frames
      }
      req.next();
    }).catch((err) => {
      req.status(err).next();
    });

  }
}

module.exports = CreateFrames;
