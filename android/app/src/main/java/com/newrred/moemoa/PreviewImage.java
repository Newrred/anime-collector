package com.newrred.moemoa;

final class PreviewImage {
    private final String fileName;
    private final int width;
    private final int height;

    PreviewImage(String fileName, int width, int height) {
        this.fileName = fileName;
        this.width = width;
        this.height = height;
    }

    String getFileName() {
        return fileName;
    }

    int getWidth() {
        return width;
    }

    int getHeight() {
        return height;
    }
}
