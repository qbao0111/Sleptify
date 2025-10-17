
using Microsoft.Web.WebView2.Core;
using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using Sleptify.Shell.Interop;

namespace Sleptify.Shell
{
    public partial class MainWindow : Window
    {
        private SpotifyAuth? _auth;
        private string _clientId = "9867291a481640d48da2e88f2ee194f1";
        private const string Redirect = "http://127.0.0.1:5173/callback";

        public MainWindow()
        {
            InitializeComponent();
            Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            _auth = new SpotifyAuth(_clientId, Redirect,
                "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative");

            await Web.EnsureCoreWebView2Async();
            Web.CoreWebView2.Settings.IsWebMessageEnabled = true;
            Web.CoreWebView2.Settings.AreDevToolsEnabled = true;
            Web.CoreWebView2.WebMessageReceived += OnMsg;

            var exeDir = AppContext.BaseDirectory;
            var html = Path.Combine(exeDir, "ui-dist", "index.html");
            Web.Source = new Uri(html);

            if (_auth.IsValid())
                await PushTokenToWebAsync(_auth.AccessToken!);
        }

        private async Task PushTokenToWebAsync(string token)
        {
            await Web.ExecuteScriptAsync($"localStorage.setItem('spotify_token','{token}');");
        }

        private async void ConnectBtn_Click(object sender, RoutedEventArgs e)
        {
            if (_auth == null) return;
            bool ok = await _auth.EnsureTokenAsync();
            if (!ok) { MessageBox.Show("Spotify auth failed."); return; }
            await PushTokenToWebAsync(_auth.AccessToken!);
            MessageBox.Show("Connected to Spotify!");
        }

        private void Close_Click(object sender, RoutedEventArgs e) => Close();

        private async void OnMsg(object? s, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                var json = e.TryGetWebMessageAsString();
                using var doc = JsonDocument.Parse(json);
                var type = doc.RootElement.GetProperty("type").GetString();

                if (type == "spotify:transfer")
                {
                    var deviceId = doc.RootElement.GetProperty("id").GetString()!;
                    var api = new SpotifyApi(_auth!);
                    await api.TransferPlaybackAsync(deviceId, true);
                }
                else if (type == "spotify:play:uri")
                {
                    var uri = doc.RootElement.GetProperty("uri").GetString()!;
                    var api = new SpotifyApi(_auth!);
                    await api.PlayUriAsync(uri);
                }
            }
            catch (Exception ex) { Debug.WriteLine(ex); }
        }
    }
}
