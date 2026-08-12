package com.newrred.moemoa;

final class StagedOriginal {
    private final String fileName;
    private final long byteSize;
    private final String checksumSha256;

    StagedOriginal(String fileName, long byteSize, String checksumSha256) {
        this.fileName = fileName;
        this.byteSize = byteSize;
        this.checksumSha256 = checksumSha256;
    }

    String getFileName() {
        return fileName;
    }

    long getByteSize() {
        return byteSize;
    }

    String getChecksumSha256() {
        return checksumSha256;
    }
}
