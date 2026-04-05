// =============================================
// Lightweight MiniSEED parser
// Supports encoding formats: 1 (int16), 3 (int32), 4/12 (float32), 5 (float64), 10 (Steim-1), 11 (Steim-2), 19 (Steim-1 fallback)
// MiniSEED spec: https://ds.iris.edu/ds/nodes/dmc/data/formats/miniseed/
// =============================================

/**
 * Parse a MiniSEED buffer and return all samples as a flat Float32Array
 * @param {ArrayBuffer} buffer
 * @param {{ maxSamples?: number }} [options]
 * @returns {number[]} sample values
 */
export function parseMiniSEED(buffer, options = {}) {
  const maxSamples = Number.isFinite(options.maxSamples) ? Math.max(1, options.maxSamples) : 50000
  const allSamples = []
  let offset = 0
  const view = new DataView(buffer)

  while (offset + 64 <= buffer.byteLength) {
    try {
      const record = parseRecord(view, buffer, offset)
      if (!record) break
      if (!Number.isFinite(record.recordLength) || record.recordLength < 64) break
      if (offset + record.recordLength > buffer.byteLength) break

      const prevOffset = offset
      for (const sample of record.samples) {
        allSamples.push(sample)
        if (allSamples.length >= maxSamples) return allSamples
      }
      offset += record.recordLength
      if (offset <= prevOffset) break
    } catch (e) {
      break
    }
  }

  return allSamples
}

function parseRecord(view, buffer, offset) {
  // Fixed section of Data Header (48 bytes)
  // Bytes 0-5: sequence number (ASCII)
  // Byte 6: data quality indicator
  // Bytes 8-12: station code
  // Bytes 13-15: location id
  // Bytes 16-19: channel id
  // Bytes 20-21: network code
  // Bytes 24-27: number of samples
  // Bytes 28-29: sample rate factor
  // Bytes 30-31: sample rate multiplier
  // Bytes 36-39: data begin offset
  // Bytes 40-43: number of blockettes

  if (offset + 48 > view.byteLength) return null

  const numSamples = view.getInt16(offset + 30, false)       // big-endian
  const dataBeginOffset = view.getUint16(offset + 44, false)
  const blocketteBeginOffset = view.getUint16(offset + 46, false)

  if (numSamples <= 0 || dataBeginOffset === 0) return null

  // Determine record length from blockette 1000
  let recordLength = 4096 // default
  let encoding = 11       // default int32

  // Walk blockettes to find Blockette 1000
  if (blocketteBeginOffset > 0 && blocketteBeginOffset < 512) {
    let bOff = offset + blocketteBeginOffset
    for (let i = 0; i < 10; i++) {
      if (bOff + 4 > view.byteLength) break
      const blocketteType = view.getUint16(bOff, false)
      const nextBlockette = view.getUint16(bOff + 2, false)

      if (blocketteType === 1000 && bOff + 8 <= view.byteLength) {
        encoding = view.getUint8(bOff + 4)
        const recLenExp = view.getUint8(bOff + 6)
        recordLength = Math.pow(2, recLenExp)
        break
      }

      if (nextBlockette === 0 || nextBlockette <= bOff - offset) break
      bOff = offset + nextBlockette
    }
  }

  if (!Number.isFinite(recordLength) || recordLength < 64 || recordLength > 65536) {
    return null
  }
  if (dataBeginOffset >= recordLength) {
    return null
  }
  if (offset + recordLength > view.byteLength) {
    return null
  }

  const dataOffset = offset + dataBeginOffset
  const samples = decodeSamples(view, buffer, dataOffset, numSamples, recordLength, encoding, offset)

  return { samples, recordLength }
}

function decodeSamples(view, buffer, dataOffset, numSamples, recordLength, encoding, recordOffset) {
  const samples = []

  switch (encoding) {
    case 1: // 16-bit integers (big-endian)
      for (let i = 0; i < numSamples; i++) {
        const pos = dataOffset + i * 2
        if (pos + 2 > view.byteLength) break
        samples.push(view.getInt16(pos, false))
      }
      break

    case 3: // 32-bit integers (big-endian)
      for (let i = 0; i < numSamples; i++) {
        const pos = dataOffset + i * 4
        if (pos + 4 > view.byteLength) break
        samples.push(view.getInt32(pos, false))
      }
      break

    case 4: // IEEE float 32
    case 12:
      for (let i = 0; i < numSamples; i++) {
        const pos = dataOffset + i * 4
        if (pos + 4 > view.byteLength) break
        samples.push(view.getFloat32(pos, false))
      }
      break

    case 5: // IEEE float 64
      for (let i = 0; i < numSamples; i++) {
        const pos = dataOffset + i * 8
        if (pos + 8 > view.byteLength) break
        samples.push(view.getFloat64(pos, false))
      }
      break

    case 10: // Steim-1 compression
      return decodeSteimI(view, dataOffset, numSamples)

    case 11: // Steim-2 compression
      return decodeSteimII(view, dataOffset, numSamples)

    case 19: // Steim-3 (fallback to Steim-1 style decoding)
      return decodeSteimI(view, dataOffset, numSamples)

    default:
      // Unknown encoding — return raw as int32
      for (let i = 0; i < numSamples; i++) {
        const pos = dataOffset + i * 4
        if (pos + 4 > view.byteLength) break
        samples.push(view.getInt32(pos, false))
      }
  }

  return samples
}

function decodeSteimI(view, dataOffset, numSamples) {
  // Steim-1: data organized in 64-byte frames
  // Each frame has a 4-byte control word followed by 15 4-byte data words
  const samples = []
  let x0 = 0    // first sample (from frame 0, word 1)
  let xn = 0    // last sample (from frame 0, word 2)
  let lastSample = 0
  let frameOffset = dataOffset
  let firstFrame = true

  while (samples.length < numSamples && frameOffset + 64 <= view.byteLength) {
    const controlWord = view.getUint32(frameOffset, false)

    for (let w = 1; w <= 15 && samples.length < numSamples; w++) {
      const dn = (controlWord >>> (30 - w * 2)) & 0x3
      const wordVal = view.getInt32(frameOffset + w * 4, false)

      if (firstFrame && w === 1) { x0 = wordVal; lastSample = x0; firstFrame = false; continue }
      if (w === 2 && frameOffset === dataOffset) { xn = wordVal; continue }

      switch (dn) {
        case 0: break // special/filler
        case 1: // 4 one-byte differences
          for (let b = 3; b >= 0 && samples.length < numSamples; b--) {
            const diff = (wordVal >> (b * 8)) & 0xFF
            lastSample += ((diff & 0x80) ? diff - 256 : diff)
            samples.push(lastSample)
          }
          break
        case 2: // 2 two-byte differences
          for (let b = 1; b >= 0 && samples.length < numSamples; b--) {
            const raw = (wordVal >> (b * 16)) & 0xFFFF
            const diff = raw > 32767 ? raw - 65536 : raw
            lastSample += diff
            samples.push(lastSample)
          }
          break
        case 3: // 1 four-byte difference
          lastSample += wordVal
          samples.push(lastSample)
          break
      }
    }

    frameOffset += 64
  }

  return samples
}

function decodeSteimII(view, dataOffset, numSamples) {
  const samples = []
  let lastSample = 0
  let frameOffset = dataOffset
  let firstFrame = true

  while (samples.length < numSamples && frameOffset + 64 <= view.byteLength) {
    const controlWord = view.getUint32(frameOffset, false)

    for (let w = 1; w <= 15 && samples.length < numSamples; w++) {
      const dn = (controlWord >>> (30 - w * 2)) & 0x3
      const wordU = view.getUint32(frameOffset + w * 4, false)
      const wordS = view.getInt32(frameOffset + w * 4, false)

      // Frame 0 word 1 is X0 (first sample), frame 0 word 2 is XN (last sample).
      if (firstFrame && w === 1) {
        lastSample = wordS
        firstFrame = false
        continue
      }
      if (frameOffset === dataOffset && w === 2) {
        continue
      }

      const diffs = unpackSteim2Word(dn, wordU)
      for (const diff of diffs) {
        if (samples.length >= numSamples) break
        lastSample += diff
        samples.push(lastSample)
      }
    }

    frameOffset += 64
  }

  return samples
}

function unpackSteim2Word(dn, wordU) {
  switch (dn) {
    case 0:
      return []
    case 1:
      // 4 x 8-bit differences
      return unpackSignedDiffs(wordU, 4, 8)
    case 2: {
      // dnib in top 2 bits selects 1x30, 2x15, or 3x10.
      const dnib = (wordU >>> 30) & 0x3
      if (dnib === 1) return unpackSignedDiffs(wordU & 0x3fffffff, 1, 30)
      if (dnib === 2) return unpackSignedDiffs(wordU & 0x3fffffff, 2, 15)
      if (dnib === 3) return unpackSignedDiffs(wordU & 0x3fffffff, 3, 10)
      return []
    }
    case 3: {
      // dnib in top 2 bits selects 5x6, 6x5, or 7x4.
      const dnib = (wordU >>> 30) & 0x3
      if (dnib === 0) return unpackSignedDiffs(wordU & 0x3fffffff, 5, 6)
      if (dnib === 1) return unpackSignedDiffs(wordU & 0x3fffffff, 6, 5)
      if (dnib === 2) return unpackSignedDiffs(wordU & 0x3fffffff, 7, 4)
      return []
    }
    default:
      return []
  }
}

function unpackSignedDiffs(wordU, count, bitsPerDiff) {
  const diffs = []
  const mask = bitsPerDiff === 30 ? 0x3fffffff : ((1 << bitsPerDiff) - 1)

  for (let i = count - 1; i >= 0; i--) {
    const shift = i * bitsPerDiff
    const raw = (wordU >>> shift) & mask
    diffs.push(signExtend(raw, bitsPerDiff))
  }

  return diffs
}

function signExtend(value, bits) {
  const shift = 32 - bits
  return (value << shift) >> shift
}
