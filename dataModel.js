// tfjs url = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js'
const tf = require('./tf.min');
const fs = require('fs');
const Heap = require('./heap');

const vectorDict = JSON.parse(fs.readFileSync('./res/z.json', 'utf-8'))

class Game {

    constructor(batchSize = 32, gInit = tf.initializers.glorotUniform(), shape = [32, 64, 128, 64]) {
        this.vectorDict = vectorDict;
        this.characters = Object.keys(this.vectorDict);
        // two sets for characters, tfDS for training
        this.positive = new Set();
        this.negative = new Set();
        this.tfDataSet = tf.data.array([]);
        // batchSize, gInit and shape are params to define network and training setup
        // history stores loss, accuracy information for plot
        this.batchSize = 32;
        this.gInit = gInit;
        this.shape = shape;
        this.model = this.createModel(shape);
        this.history = {loss: [], acc: []};
    }


    // add new Labelled sample into tfDS, return 400 sorted possible characters
    // make sure newPositive and newNegative are both Set
    putData(newPositive, newNegative) {
        if (newPositive.size !== this.positive.size || newNegative.size !== this.negative.size) {
            let positive = this.union(this.positive, newPositive);
            let negative = this.union(this.negative, newNegative);
            let repeated = this.intersection(positive, negative);

            this.positive = this.difference(positive, repeated);
            this.negative = this.difference(negative, repeated);
            this.updateDateSet();
        }
        this.train();

        return this.predict();
    }


    // change the model and load samples into tfDS, return 400 sorted possible characters
    resetModel(newPositive, newNegative, shape = this.shape) {
        this.model = this.createModel(shape);
        this.putData(newPositive, newNegative);
    }


    // **** Above are public apis ***

    // create a new model
    createModel(shape) {
        let model = tf.sequential();

        model.add(tf.layers.inputLayer({inputShape: [64]}));
        // hidden layers
        for (let i = 0; i < shape.length; i++) {
            model.add(tf.layers.dense({
                units: shape[i],
                kernelConstraint: tf.constraints.maxNorm(3),
                kernelInitializer: this.gInit
            }));
            model.add(tf.layers.batchNormalization());
            model.add(tf.layers.leakyReLU());
        }
        model.add(tf.layers.dense({units: 2, activation: 'softmax'}));

        model.compile({
            loss: 'categoricalCrossentropy',
            optimizer: tf.train.rmsprop(0.004),
            metrics: ['accuracy']
        });
        return model;
    }


    // convert characters in positive and negative into vectors in tfDS
    updateDateSet() {
        let positivetfArray = tf.data.array(this.shuffle(Array.from(this.positive))).map(value =>
            ({xs: this.vectorDict[value], ys: [0, 1]}));
        let negativetfArray = tf.data.array(this.shuffle(Array.from(this.negative))).map(value =>
            ({xs: this.vectorDict[value], ys: [1, 0]}));
        this.tfDataSet = positivetfArray.concatenate(negativetfArray);
    }


    train(epochs = 4) {

        this.model.fitDataset(this.tfDataSet.repeat(-1).batch(this.batchSize), {
            epochs: epochs,
            batchesPerEpoch: Math.ceil(this.tfDataSet.size / this.batchSize)
        }).then(h => {
            this.history.loss.concat(h.history.loss);
            this.history.acc.concat(h.history.acc)
        });

        console.log(`Train done with ${this.positive.size} positive and ${this.negative.size} negative samples.`)

    }


    // predict and sort according to possibility of being negative in ascending order
    // return sorted characters' array
    predict() {
        let input = tf.tensor2d(this.characters.map(value =>
            this.vectorDict[value]));
        let result = this.model.predict(input).dataSync();
        // minHeap to sort possibility of being negative in ascending order
        let minHeap = new Heap((a, b) => [a[1] - b[1]]);
        for (let i = 0; i < this.characters.length; i++) {
            minHeap.push([this.characters[i], result[2 * i]]);
        }

        // output first 400 possible characters
        let output = []
        while (output.length < 400 && !minHeap.empty()) {
            let item = minHeap.pop();
            if (!this.positive.has(item[0])) {
                output.push(item[0]);
            }
        }

        return output;
    }


    // functions for set computation
    intersection(A, B) {
        let arrayA = Array.from(A);
        return new Set(arrayA.filter(function (value, index, array) {
            return B.has(value);
        }));
    }


    union(A, B) {
        let arrayA = Array.from(A);
        let arrayB = Array.from(B);
        return new Set(arrayA.concat(arrayB));
    }


    difference(A, B) {
        let arrayA = Array.from(A);
        return new Set(arrayA.filter(function (value, index, array) {
            return !B.has(value);
        }));
    }


    //  Fisher-Yates shuffle
    shuffle(array) {
        let counter = array.length;

        while (counter > 0) {
            let index = Math.floor(Math.random() * counter);
            counter--;
            let temp = array[counter];
            array[counter] = array[index];
            array[index] = temp;
        }
        return array;
    }
}

g = new Game();
a = new Set(['是']);
b = new Set(['噢']);
console.log(g.putData(a, b));

module.exports = Game;