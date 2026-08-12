package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class AndroidImagePreviewerContractTest {

    @Test
    public void previewNameIsDerivedOnlyFromSafeOpaqueTicket() throws Exception {
        assertEquals("ticket-1.preview.jpg", AndroidImagePreviewer.previewFileNameFor("ticket-1"));
    }

    @Test(expected = ImageIntakeException.class)
    public void rejectsUnsafeTicketBeforeResolvingFiles() throws Exception {
        AndroidImagePreviewer.previewFileNameFor("../outside");
    }
}
