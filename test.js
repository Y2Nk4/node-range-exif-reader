let fs = require('fs'),
    RangeExifParser = require('./index')

;(async () => {
    let randomPics = `http://picsum.photos/seed/${Math.round(Math.random() * 1000000)}/300/300`
    console.log('Fetching:', randomPics)
    let exifParser = new RangeExifParser('https://cloud.xitek.com/pics/201409/284/28404/28404_1411197385.jpg', {
        proxy: 'http://localhost:10087', tunnel: true
    })
    console.log('result', await exifParser.load())
})()
