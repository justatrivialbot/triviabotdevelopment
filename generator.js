$(document).ready(function() {

	// only show the TPQ section if they want a Timed quiz.
	$('.tpq').hide();
	$('input[name=Scoring]').change(function() {
		if ($('input[name=Scoring]:checked').val() == 'Timed') {
			$('.tpq').show();
		} else {
			$('.tpq').hide();
		}
	});
	
	// Timezone helper
	var date = new Date();
	var offset = date.getTimezoneOffset(); // in minutes
	var offsetHours = offset/60;
	
	var timestring;
	
	if (offsetHours < 0) { // subtracting hours
		timestring = "subtract " + Math.abs(offsetHours) + " from ";
	} else {
		timestring = "add " + Math.abs(offsetHours) + " to ";
	}
	$('#offset').text(timestring);
	
	// start setting up the textarea to hold our JSON array.
	var sText = "{\n}";
	$('textarea').val(sText);

	// Form processing
	$('input').change(function() {
		sText = "{";
		
		// loop through the metadata section.
		$('#metadata input').each(function() {
			if (($(this).attr('type') != 'radio') && ($(this).val().length > 0)) {
				sText += "\n\t\"" + $(this).attr('name') + "\": \"" + $(this).val() + "\",";
			}
			if (($(this).attr('type') == 'radio') && ($(this).is(':checked'))) {
				sText += "\n\t\"" + $(this).attr('name') + "\": \"" + $(this).val() + "\",";
			}
		});
		
		// Ok now on to the questions, which must be looped in per-question chunks.
		sText += "\n\t\"questions\" : [";
		$('.questionsets').each(function() {
			sText += "{\n";
			sText += "\t\t\"Type\": \"" + $(this).find('input[name=qType]:checked').val() + "\",";
			sText += "\n\t\t\"Text\": \"" + $(this).find('input[name=qText]').val() + "\",";
			sText += "\n\t\t\"Correct\": \"" + $(this).find('input[name=Correct]').val() + "\",";
			if ($(this).find('input[name="qType"]:checked').val()=="MC") {
				sText += "\n\t\t\"Incorrect\": \"" + $(this).find('input[name=Incorrect]').val() + "\",";
			}
			sText += "\n\t\t\"PV\": \"" + $(this).find('input[name=PV]').val() + "\""; // last item, no comma
			sText += "\n\t},"
		});
		
		// remove the last comma
		sText = sText.substring(0, sText.length -1);
		
		// Close the array and update the textarea
		sText += "]\n}";
		$('textarea').val(sText);
	});
	
	// Add question button
	$('#addQuestion').click(function() {
		$('#questionset').clone(true).find("input:text").val("").end().appendTo("#questions");
		
	});
	
	// click to select
	$('#snippet').on("click", function() {
		$(this).select();
	})
})