package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.util.Map;
import org.junit.Test;

public class PublicIntakeTicketTest {

    @Test
    public void exposesOnlyComposerSafeMetadataAndBoundedPreview() {
        PendingIntakeTicket privateTicket = new PendingIntakeTicket(
            "ticket-1",
            "ticket-1.original",
            "ticket-1.preview.jpg",
            "image/png",
            42L,
            "private-checksum",
            1920,
            1080,
            123L
        );

        Map<String, Object> value = PublicIntakeTicket.from(
            privateTicket,
            "data:image/jpeg;base64,cHJldmlldw=="
        ).toMap();

        assertEquals("ticket-1", value.get("ticketId"));
        assertEquals("data:image/jpeg;base64,cHJldmlldw==", value.get("previewDataUrl"));
        assertFalse(value.containsKey("stagedFileName"));
        assertFalse(value.containsKey("previewFileName"));
        assertFalse(value.containsKey("checksumSha256"));
        assertFalse(value.containsKey("sourceUri"));
        assertEquals(8, value.size());
    }
}
