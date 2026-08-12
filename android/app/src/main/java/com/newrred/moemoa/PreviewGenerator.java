package com.newrred.moemoa;

interface PreviewGenerator {
    PreviewImage create(String ticketId, String stagedFileName) throws ImageIntakeException;
}
