package se.snolage.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Our own plugins must be registered before the bridge starts.
        registerPlugin(HealthRoutesPlugin.class);
        registerPlugin(BackgroundImportPlugin.class);
        registerPlugin(ShareLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
