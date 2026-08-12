package com.newrred.moemoa;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import androidx.core.content.IntentCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImageIntakePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null || bridge == null) return;

        Uri stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
        ImageShareIntentPolicy.Result result = ImageShareIntentPolicy.evaluate(
            intent.getAction(),
            intent.getType(),
            stream != null
        );
        if (result != ImageShareIntentPolicy.Result.ACCEPT) return;

        ImageIntakeRuntime runtime = ImageIntakeRuntime.get(this);
        if (!ImageShareIntentPolicy.acceptsSourceScheme(stream.getScheme())) {
            runtime.recordErrorCode("UNSUPPORTED_SOURCE_URI");
            consumeShareIntent(intent);
            navigateToComposer();
            return;
        }

        runtime.capture(stream, intent.getType());
        consumeShareIntent(intent);
        navigateToComposer();
    }

    private void navigateToComposer() {
        bridge.getWebView().post(() ->
            bridge.getWebView().loadUrl(bridge.getLocalUrl() + NativeRoutes.memoryComposerPath())
        );
    }

    private void consumeShareIntent(Intent intent) {
        intent.removeExtra(Intent.EXTRA_STREAM);
        intent.setAction(Intent.ACTION_MAIN);
        setIntent(intent);
    }
}
