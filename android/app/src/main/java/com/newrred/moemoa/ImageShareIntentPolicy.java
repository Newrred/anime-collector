package com.newrred.moemoa;

import java.util.Locale;

final class ImageShareIntentPolicy {
    private static final String ACTION_SEND = "android.intent.action.SEND";

    enum Result {
        ACCEPT,
        UNSUPPORTED_ACTION,
        UNSUPPORTED_MIME,
        MISSING_STREAM
    }

    private ImageShareIntentPolicy() {}

    static Result evaluate(String action, String mimeType, boolean hasStream) {
        if (!ACTION_SEND.equals(action)) {
            return Result.UNSUPPORTED_ACTION;
        }

        if (mimeType == null || !mimeType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            return Result.UNSUPPORTED_MIME;
        }

        if (!hasStream) {
            return Result.MISSING_STREAM;
        }

        return Result.ACCEPT;
    }

    static boolean acceptsSourceScheme(String scheme) {
        return "content".equalsIgnoreCase(scheme);
    }
}
