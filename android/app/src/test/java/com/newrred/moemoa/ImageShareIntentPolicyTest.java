package com.newrred.moemoa;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ImageShareIntentPolicyTest {

    @Test
    public void acceptsSingleImageShareWithStream() {
        assertEquals(
            ImageShareIntentPolicy.Result.ACCEPT,
            ImageShareIntentPolicy.evaluate("android.intent.action.SEND", "image/jpeg", true)
        );
    }

    @Test
    public void rejectsMultipleImageShare() {
        assertEquals(
            ImageShareIntentPolicy.Result.UNSUPPORTED_ACTION,
            ImageShareIntentPolicy.evaluate("android.intent.action.SEND_MULTIPLE", "image/png", true)
        );
    }

    @Test
    public void rejectsNonImageMimeType() {
        assertEquals(
            ImageShareIntentPolicy.Result.UNSUPPORTED_MIME,
            ImageShareIntentPolicy.evaluate("android.intent.action.SEND", "text/plain", true)
        );
    }

    @Test
    public void rejectsImageShareWithoutStream() {
        assertEquals(
            ImageShareIntentPolicy.Result.MISSING_STREAM,
            ImageShareIntentPolicy.evaluate("android.intent.action.SEND", "image/webp", false)
        );
    }

    @Test
    public void acceptsOnlyContentUrisForImmediatePrivateCopy() {
        assertEquals(true, ImageShareIntentPolicy.acceptsSourceScheme("content"));
        assertEquals(false, ImageShareIntentPolicy.acceptsSourceScheme("file"));
        assertEquals(false, ImageShareIntentPolicy.acceptsSourceScheme("https"));
    }
}
