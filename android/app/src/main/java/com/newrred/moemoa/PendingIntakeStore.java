package com.newrred.moemoa;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import java.util.regex.Pattern;

final class PendingIntakeStore {
    private static final Pattern SAFE_TICKET_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");
    private static final Pattern SAFE_FILE_NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._-]{0,127}");
    private static final String TICKET_SUFFIX = ".ticket";

    private final File root;

    PendingIntakeStore(File root) {
        this.root = root;
    }

    synchronized void save(PendingIntakeTicket ticket) throws IOException {
        ensureRoot();
        File destination = fileFor(ticket.getTicketId());
        File temporary = new File(root, ticket.getTicketId() + ".tmp");

        Properties properties = new Properties();
        properties.setProperty("ticketId", ticket.getTicketId());
        privateFile(ticket.getStagedFileName());
        privateFile(ticket.getPreviewFileName());
        properties.setProperty("stagedFileName", ticket.getStagedFileName());
        properties.setProperty("previewFileName", ticket.getPreviewFileName());
        properties.setProperty("mimeType", ticket.getMimeType());
        properties.setProperty("byteSize", Long.toString(ticket.getByteSize()));
        properties.setProperty("checksumSha256", ticket.getChecksumSha256());
        properties.setProperty("width", Integer.toString(ticket.getWidth()));
        properties.setProperty("height", Integer.toString(ticket.getHeight()));
        properties.setProperty("createdAtEpochMs", Long.toString(ticket.getCreatedAtEpochMs()));

        try (FileOutputStream output = new FileOutputStream(temporary)) {
            properties.store(output, null);
            output.getFD().sync();
        }

        if (destination.exists() && !destination.delete()) {
            temporary.delete();
            throw new IOException("Unable to replace pending intake ticket");
        }
        if (!temporary.renameTo(destination)) {
            temporary.delete();
            throw new IOException("Unable to finalize pending intake ticket");
        }
    }

    synchronized Optional<PendingIntakeTicket> claimOldest() throws IOException {
        if (!root.exists()) return Optional.empty();

        File[] files = root.listFiles((directory, name) -> name.endsWith(TICKET_SUFFIX));
        if (files == null || files.length == 0) return Optional.empty();

        List<PendingIntakeTicket> tickets = new ArrayList<>();
        for (File file : files) {
            tickets.add(read(file));
        }
        tickets.sort(Comparator.comparingLong(PendingIntakeTicket::getCreatedAtEpochMs));
        return Optional.of(tickets.get(0));
    }

    synchronized Optional<PendingIntakeTicket> find(String ticketId) throws IOException {
        File file = fileFor(ticketId);
        return file.exists() ? Optional.of(read(file)) : Optional.empty();
    }

    synchronized boolean discard(String ticketId) throws IOException {
        Optional<PendingIntakeTicket> pending = find(ticketId);
        if (!pending.isPresent()) return true;

        PendingIntakeTicket ticket = pending.get();
        if (!deleteIfPresent(privateFile(ticket.getStagedFileName()))) return false;
        if (!deleteIfPresent(privateFile(ticket.getPreviewFileName()))) return false;
        return deleteIfPresent(fileFor(ticketId));
    }

    private PendingIntakeTicket read(File file) throws IOException {
        Properties properties = new Properties();
        try (FileInputStream input = new FileInputStream(file)) {
            properties.load(input);
        }

        try {
            PendingIntakeTicket ticket = new PendingIntakeTicket(
                required(properties, "ticketId"),
                required(properties, "stagedFileName"),
                required(properties, "previewFileName"),
                required(properties, "mimeType"),
                Long.parseLong(required(properties, "byteSize")),
                required(properties, "checksumSha256"),
                Integer.parseInt(required(properties, "width")),
                Integer.parseInt(required(properties, "height")),
                Long.parseLong(required(properties, "createdAtEpochMs"))
            );
            validateRecoveredTicket(file, ticket);
            return ticket;
        } catch (IllegalArgumentException exception) {
            throw new IOException("Invalid pending intake ticket", exception);
        }
    }

    private void validateRecoveredTicket(File ticketFile, PendingIntakeTicket ticket) {
        String ticketId = ticket.getTicketId();
        File expectedTicketFile = fileFor(ticketId);
        privateFile(ticket.getStagedFileName());
        privateFile(ticket.getPreviewFileName());

        if (!ticketFile.getName().equals(expectedTicketFile.getName())) {
            throw new IllegalArgumentException("Ticket id does not match ticket file");
        }
        if (!ticket.getStagedFileName().equals(ticketId + ".original")) {
            throw new IllegalArgumentException("Unexpected staged image file name");
        }
        if (!ticket.getPreviewFileName().equals(ticketId + ".preview.jpg")) {
            throw new IllegalArgumentException("Unexpected preview image file name");
        }
        if (
            ticket.getByteSize() < 0L ||
            ticket.getWidth() <= 0 ||
            ticket.getHeight() <= 0 ||
            ticket.getCreatedAtEpochMs() < 0L
        ) {
            throw new IllegalArgumentException("Invalid pending image metadata");
        }
    }

    private File fileFor(String ticketId) {
        if (ticketId == null || !SAFE_TICKET_ID.matcher(ticketId).matches()) {
            throw new IllegalArgumentException("Unsafe ticket id");
        }
        return new File(root, ticketId + TICKET_SUFFIX);
    }

    private File privateFile(String fileName) {
        if (fileName == null || !SAFE_FILE_NAME.matcher(fileName).matches()) {
            throw new IllegalArgumentException("Unsafe private file name");
        }
        return new File(root, fileName);
    }

    private static boolean deleteIfPresent(File file) {
        return !file.exists() || file.delete();
    }

    private void ensureRoot() throws IOException {
        if (!root.exists() && !root.mkdirs()) {
            throw new IOException("Unable to create pending intake directory");
        }
        if (!root.isDirectory()) {
            throw new IOException("Pending intake path is not a directory");
        }
    }

    private static String required(Properties properties, String key) {
        String value = properties.getProperty(key);
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("Missing " + key);
        }
        return value;
    }
}
