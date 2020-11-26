let request = require('request'),
    { ExifImage } = require('exif'),
    { EventEmitter } = require('events')

const EXIF_FLAG = Buffer.from('457869660000', 'hex')

class RangeExifParser extends EventEmitter {
    constructor (fileUrl, options = {}) {
        super()

        this.options = options || {}
        this.options.requestChunkSize = 10000 // unit: Bytes
        this.fileUrl = fileUrl

        if (!fileUrl) throw new Error('fileUrl cannot be empty')

        this.decodeOffset =0
        this.loadedOffset = 0
        this.buffer = null
        this.fileFullSize = null
        this.loadFullFile = false
    }

    async load () {
        return new Promise(async (resolve, reject) => {
            await this.loadMoreContent()

            if (!this.loadFullFile) {
                if (this.buffer[this.decodeOffset++] !== 0xFF || this.buffer[this.decodeOffset++] !== 0xD8) {
                    return Promise.reject(new Error('Not able to parse: File is not Jpeg'))
                }

                while (this.buffer[this.decodeOffset] === 0xFF) {
                    if (this.loadedOffset <= this.decodeOffset + 50) {
                        await this.loadMoreContent()
                    }
                    let marker = await this._parseJPegMarkers()
                    if (marker.markerData.slice(0, 6).equals(EXIF_FLAG)) {
                        console.log('EXIF', marker)
                        break;
                    }
                }
            }

            new ExifImage(this.buffer, (error, data) => {
                if (error) return reject(error)
                return resolve(data)
            })
        })
    }

    async loadMoreContent (loadByteLength) {
        loadByteLength = loadByteLength || this.options.requestChunkSize
        let { res, body } = await this.requestFileRange(
            this.fileUrl,
            this.loadedOffset, this.loadedOffset += loadByteLength,
            { proxy: this.options.proxy, tunnel: this.options.tunnel }
        )
        this.updateChunkInfo(res, body, loadByteLength)
        return Promise.resolve()
    }

    async _parseJPegMarkers () {
        let markerStart = this.decodeOffset
        let markerFlag = this.buffer.slice(this.decodeOffset, this.decodeOffset += 2)
        if (markerFlag[0] !== 0xFF) {
            return false
        }
        let markerLength = this.buffer.readUInt16BE(this.decodeOffset)
        this.decodeOffset += 2

        if ((this.decodeOffset + markerLength) <= this.loadedOffset) {
            await this.loadMoreContent(this.loadedOffset - (this.decodeOffset + markerLength) + 100)
        }

        let markerData = this.buffer.slice(this.decodeOffset, this.decodeOffset + markerLength - 2)
        this.decodeOffset = markerStart + markerLength
        return Promise.resolve({
            markerStart, markerFlag, markerData, markerLength
        })
    }

    updateChunkInfo (res, body, loadByteLength) {
        if (parseInt(res.headers['content-length']) !== loadByteLength && !res.headers['content-range']) {
            this.emit('debug', 'This source is not supporting Range Feature')
            this.loadFullFile = true
            this.buffer = body
        } else {
            let contentRange = /bytes (\d*)-(\d*)\/(\d*)/.exec(res.headers['content-range'])
            this.loadedOffset = parseInt(contentRange[2])
            this.fileFullSize = parseInt(contentRange[3])
            if (!this.buffer) this.buffer = Buffer.alloc(parseInt(contentRange[3]))
            this.buffer.fill(body, parseInt(contentRange[1]), parseInt(contentRange[2]))
        }
    }

    requestFileRange (url, from = 0, to, options = {}) {
        return new Promise((resolve, reject) => {
            request({ url, encoding: null, headers: {
                    Range: `bytes=${from}-${to}`
                }, proxy: options.proxy, tunnel: options.tunnel || false
            }, (err, res, body) => {
                if (err)
                    return reject(err)

                return resolve({ res, body })
            })
        })
    }
}

module.exports = RangeExifParser
