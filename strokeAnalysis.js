const strokeInfoDict = require('./res/strokeInfo')
const Heap = require('./Heap')

class Node {

    constructor(last = null, gene = []) {
        this.last = last;
        this.gene = gene;
    }


    isLegalToAppend(value) {
        return value > this.last;
    }


    append(value) {
        this.last = value;
        this.gene.push(value);
    }

}

class Vector {

    constructor(value = []) {
        this.value = value;
    }


    normalized() {
        return this.value.map(value => value / this.sum());
    }


    unified() {
        return this.value.map(value => value / this.norm());
    }


    norm() {
        let normSquared = 0;
        for (let i = 0; i < this.value.length; i++) {
            normSquared += Math.pow(this.value[i], 2);
        }
        return Math.sqrt(normSquared);
    }


    sum() {
        let sum = 0;
        for (let i = 0; i < this.value.length; i++) {
            sum += this.value[i];
        }
        return sum;
    }
}

class StrokeAnalysis {

    constructor() {
        this.characters = Object.keys(strokeInfoDict);
    }


    // find first 200 most similar substructures
    // return array of potential characters in descending order and array of negative
    search(refCharacter, refPositions) {
        return this.searchWithRange(refCharacter,refPositions,this.characters);
    }

    searchWithRange(refCharacter, refPositions, characters) {
        let potentialHeap = new Heap((a, b) => a[1] - b[1]);
        let negative = [];

        let refIndex = strokeInfoDict[refCharacter].index;
        let substructure = refPositions.map(value => refIndex[value]).join('');


        characters.forEach(character => {
            if (!this.isPotential(substructure, strokeInfoDict[character].index)) {
                negative.push(character);
            } else {
                let diff = this.computeSmallestDifference(refCharacter, refPositions, character);
                diff > 4 ? negative.push(character) : potentialHeap.push([character, diff]);
            }
        })

        let potential = [];
        for (let i = 0; potential.push(potentialHeap.pop()[0]) < 200; i++) {
        }
        return [potential, negative]
    }

    // **** Above are public apis ***

    // *** stroke order analysis ***
    // find all positions in string of pattern reg
    regExpFindAll(reg, string) {
        let m;
        let matches = [];
        while (m = (reg.exec(string))) {
            matches.push(m.index);
        }
        return matches;
    }


    // whether a stroke sequence is potential of having certain substructure on stroke stroke order level
    isPotential(substructure, strokeSequence) {
        substructure = Array.from(substructure).map(value => `\\d*${value}+`).join('') + '\\d*';
        let reg = new RegExp(substructure, 'g');

        return strokeSequence.match(reg) != null;
    }


    // 5 arrays of positions of 1,2,3,4,5
    basicStrokesPositionsOf(strokeSequence) {
        let result = [];
        while (result.push(0) < 5) {
        }
        result = result.map((value, index) => {
            return this.regExpFindAll(new RegExp(index + 1, 'g'), strokeSequence)
        });

        return result;
    }


    computeChunkNum(positions) {
        let chunkNum = 1;
        for (let i = 0; i < positions.length - 1; i++) {
            if (positions[i + 1] - positions[i] > 1) {
                chunkNum += 1;
            }
        }
        return chunkNum;
    }


    // look for possible substructure stroke positions in stroke sequence
    // search in stroke-wise way
    strokePositionsOf(substructure, strokeSequence) {
        let basicStrokePositions = this.basicStrokesPositionsOf(strokeSequence);
        // record first stroke positions
        let thisStrokePositions = basicStrokePositions[parseInt(substructure[0]) - 1];
        let thisNodeList = thisStrokePositions.map(value => new Node(value, [value]));
        // look for other strokes
        for (let i = 1; i < substructure.length; i++) {
            let nextStrokePositions = basicStrokePositions[parseInt(substructure[i]) - 1];
            let nextNodeList = [];
            // loop for each possible connection
            for (let j = 0; j < thisNodeList.length; j++) {
                let node = thisNodeList[j];
                for (let k = 0; k < nextStrokePositions.length; k++) {
                    let position = nextStrokePositions[k];
                    if (node.isLegalToAppend(position)) {
                        let validNode = new Node(node.last, node.gene.slice());
                        validNode.append(position);
                        nextNodeList.push(validNode);
                    }
                }
            }
            thisNodeList = nextNodeList;
        }
        return thisNodeList.map(node => node.gene);
    }


    // *** histogram analysis ***
    pickHistogramInfo(histograms, positions) {
        let strokeWiseHistograms = positions.map(value => histograms[value]);

        let overallHistogram = [];
        for (let i = 0; overallHistogram.push(0) < 4; i++) {
        }

        for (let i = 0; i < strokeWiseHistograms.length; i++) {
            for (let j = 0; j < 4; j++) {
                overallHistogram[j] += strokeWiseHistograms[i][j];
            }
        }

        strokeWiseHistograms = strokeWiseHistograms.map(value => {
            let v = new Vector(value);
            return v.normalized();
        })

        let v = new Vector(overallHistogram);
        overallHistogram = v.unified();

        return [strokeWiseHistograms, overallHistogram]
    }


    // *** trajectory analysis ***
    pickTrajectoryInfo(centroidLocations, positions) {
        let trajs = [];
        for (let i = 0; i < positions.length - 1; i++) {
            trajs.push([centroidLocations[positions[i + 1]][0] - centroidLocations[positions[i]][0],
                centroidLocations[positions[i + 1]][1] - centroidLocations[positions[i]][1]])
        }

        trajs = trajs.map(value => Math.acos(new Vector(value).unified()[0]));
        return trajs;

    }


    // *** difference computation ***
    computeDifference(refInfo, info, positions) {
        let [refHists, refOverallHist, refTraj] = refInfo;
        let [hists, overallHist, traj] = info;

        // stroke-wise hist diff
        let histsDeviation = hists.map((value1, index1) => {
            return value1.map((value2, index2) => value2 - refHists[index1][index2]);
        }).map(value => new Vector(value).norm() / 2);
        let histsDiff = histsDeviation.reduce((a, b) => a + b);

        // overall hist diff
        let overallHistDeviation = overallHist.map((value, index) => (value - refOverallHist[index]) / 2);
        let overallHistDiff = new Vector(overallHistDeviation).norm();

        // traj diff
        let trajDiff = 1;
        if (traj.length > 2) {
            let trajDeviation = traj.map((value, index) => value - refTraj[index]);
            let power = traj.map((value, index) => positions[index + 1] - positions[index]);
            trajDiff = trajDeviation.map((angle, index) => Math.pow(Math.abs(Math.tan(angle / 2)) + 1, power[index]));
            trajDiff = trajDiff.reduce((a, b) => a * b);
        }


        // add all
        let chunkNum = this.computeChunkNum(positions);
        let diff = overallHistDiff * histsDiff * trajDiff * Math.pow(chunkNum, chunkNum);

        return diff;

    }


    // smallest of all possibilities
    computeSmallestDifference(refc, refPositions, c) {
        let [refIndex, refHist, refTraj] = [strokeInfoDict[refc].index, strokeInfoDict[refc].hist, strokeInfoDict[refc].traj];
        let [index, hists, trajs] = [strokeInfoDict[c].index, strokeInfoDict[c].hist, strokeInfoDict[c].traj];
        let substructure = refPositions.map(value => refIndex[value]).join('');
        let [refStrokeHists, refOverallHists] = strokeAnalysis.pickHistogramInfo(refHist, refPositions);
        refTraj = strokeAnalysis.pickTrajectoryInfo(refTraj, refPositions);
        let refInfo = [refStrokeHists, refOverallHists, refTraj];

        // go through all possibilities
        let potentialPositions = this.strokePositionsOf(substructure, index);
        let smallestDiff = 10000;
        potentialPositions.forEach(positions => {
            let [strokeHists, overallHist] = strokeAnalysis.pickHistogramInfo(hists, positions);
            let pickedTrajs = strokeAnalysis.pickTrajectoryInfo(trajs, positions);
            let info = [strokeHists, overallHist, pickedTrajs];
            let diff = this.computeDifference(refInfo, info, positions);
            if (diff < smallestDiff) {
                smallestDiff = diff;

            }
        })
        return smallestDiff;
    }

}

module.exports = StrokeAnalysis;