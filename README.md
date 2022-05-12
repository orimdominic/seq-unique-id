# Solutions

## 1

We can create a sequence generator that returns 64-bit IDs based on three
 elements
1. The Epoch timestamp in milliseconds. This can be represented with 41 bits (2^41 - 1), or 2199023255551, which is Wednesday, September 7, 2039 3:47:35.551 PM. That gives us 69 years with respect to a custom epoch.
2. The nodeId, 10 bits, 2^10 nodes per machine. Max value of ((2^10) -1), 1023.
3. The local count per machine which is 12 bits. Max value of (((2^12)) - 1), 4095
4. An extra 1 bit, signed and always set to 0

The `SequenceGenerator` class in `controller-logic.ts` returns a singleton, and the node id parameter of the constructor can be made global.
The node id generated from the constructor's node id parameter or the computer's
MAC address guarantees that a generated id will be unique as the MAC address
of computers are different, and it eventually becomes part of the generated id.

The timestamp is used as part of the generated id to make the id sequential, as
timestamps are in themselves sequential. The timestamps's boundary is the
maximum timestamp, 2^41 - 1 bits with respect to epoch (2015-01-01T00:00:00Z).
The first 41 bits of the id (after the signed bit) are populated with the
current timestamp.

```ts
let id = currentTimestamp << (SequenceGenerator.#params.NODE_ID_BITS + SequenceGenerator.#params.SEQUENCE_BITS)
```

Then we fill the next 10 bits with the node id

```ts
id |= (this.#nodeId << SequenceGenerator.#params.SEQUENCE_BITS)
```
And finally, the last 12 bits are filled with the local counter

```ts
id |= this.#sequence
```

Which produces the generated id

With all controllers are generating their ids from the same instance of
`SequenceGenerator` there is guarantee that the ids generated will be sequential
and unique.

## 2
Why do you think it is a bad idea to simply solve the above issue with keeping
the sequence in a database?

Keeping and tracking the sequence via a database, even one as fast as Redis,
will be a bad idea because there will be an overload of writes and reads on the
tracking database.
In order to make databases implement ACID, there will be database locks during
writes. This is not good for a system where multiple instances of the controller
are trying to read and/or write to the database simultaneously. It is bad for
performance and latency.