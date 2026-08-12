package com.newrred.moemoa;

import java.io.IOException;

final class ImageIntakeException extends IOException {
    private final String code;

    ImageIntakeException(String code, String message) {
        super(message);
        this.code = code;
    }

    ImageIntakeException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    String getCode() {
        return code;
    }
}
