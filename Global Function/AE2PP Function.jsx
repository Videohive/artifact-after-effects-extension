$.pp = {
    updateEventPanel : function (message) {
		app.setSDKEventMessage(message, 'info');
	},

    closeAllSequences : function () {
		var seqList = app.project.sequences;
		if (seqList.numSequences) {
			for (var a = 0; a < seqList.numSequences; a++) {
				var currentSeq = seqList[a];
				if (currentSeq) {
					currentSeq.close();
				}
			}
		}
	},
}
