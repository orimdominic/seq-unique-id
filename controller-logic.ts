import { networkInterfaces } from "os"
import { Buffer } from 'buffer'
import { randomBytes } from 'crypto'

String.prototype.hashCode = function () {
  var hash = 0, i, chr;
  if (this.length === 0) return hash;
  for (i = 0; i < this.length; i++) {
    chr = this.charCodeAt(i);
    hash = ((hash << 10) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

class SequenceGenerator {
  static #params = Object.freeze({
    UNUSED_BITS: 1, // Sign bit, Unused (always set to 0)
    EPOCH_BITS: 41,
    NODE_ID_BITS: 10,
    SEQUENCE_BITS: 12
  })

  static #max = Object.freeze({
    NODE_ID: (Math.pow(2, SequenceGenerator.#params.NODE_ID_BITS) - 1),
    SEQUENCE: (Math.pow(2, SequenceGenerator.#params.SEQUENCE_BITS) - 1)
  })

  // Custom Epoch (January 1, 2015 Midnight UTC = 2015-01-01T00:00:00Z)
  static #CUSTOM_EPOCH = 1420070400000

  #isInstantiated = false
  #nodeId
  #lastTimestamp = -1
  #sequence = 0
  constructor(nodeId?: number) {
    if (!this.#isInstantiated) {
      if (nodeId && (nodeId < 0 || nodeId > SequenceGenerator.#max.NODE_ID)) {
        throw new Error(`nodeId' must be between 0 and ${SequenceGenerator.#max.NODE_ID}`)
      }
      if (nodeId) {
        this.#nodeId = nodeId
      } else {
        this.#nodeId = this.createNodeId()
      }
      this.#isInstantiated = true
    }
  }

  private createNodeId() {
    let nodeId
    let allInterfaces = []
    for (const [key, interfaces] of Object.entries((networkInterfaces()))) {
      allInterfaces.push(...interfaces)
    }
    try {
      let hexStrArr = [];
      for (let i = 0; i <= allInterfaces.length; i++) {
        let interfaceAtIndex = allInterfaces[i]
        let macAddress = interfaceAtIndex['mac']
        if (macAddress) {
          hexStrArr.push(Buffer.from(macAddress, 'utf8').toString('hex'))
        }
      }
      nodeId = hexStrArr.join('').hashCode()
    } catch (error) {
      nodeId = randomBytes(32).toString('hex').hashCode()
    }
    nodeId = nodeId & SequenceGenerator.#max.NODE_ID
  }

  private getTimestamp() {
    return new Date().getTime() - SequenceGenerator.#CUSTOM_EPOCH
  }

  nextId() {
    let currentTimestamp = this.getTimestamp()
    if (currentTimestamp < (this.#lastTimestamp - SequenceGenerator.#CUSTOM_EPOCH)) {
      throw new Error("Invalid system clock");
    }

    if (currentTimestamp == this.#lastTimestamp) {
      this.#sequence = (this.#sequence + 1) & SequenceGenerator.#max.SEQUENCE
      if (this.#sequence == 0) {
        // Sequence Exhausted, wait till next millisecond.
        currentTimestamp = this.waitNextMillisecs(currentTimestamp);
      }
    } else {
      this.#sequence = 0
    }

    this.#lastTimestamp = currentTimestamp
    let id = currentTimestamp << (SequenceGenerator.#params.NODE_ID_BITS + SequenceGenerator.#params.SEQUENCE_BITS)
    id |= (this.#nodeId << SequenceGenerator.#params.SEQUENCE_BITS)
    id |= this.#sequence
    return id
  }

  private waitNextMillisecs(currentTimestamp: number) {
    while (currentTimestamp == this.#lastTimestamp) {
      currentTimestamp = this.getTimestamp()
    }
    return currentTimestamp
  }
}

const generator = new SequenceGenerator()

// Controller
export default function (req, res) {
  res.send(generator.nextId())
}