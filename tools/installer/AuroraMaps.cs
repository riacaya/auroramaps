// =====================================================
// AuroraMaps.exe — peluncur Windows (mode aplikasi)
// =====================================================
// Dilakukan saat dijalankan (dobel-klik dari Start Menu / Desktop):
//   1. Cek Node.js; bila belum ada → pesan jelas, jangan diam saja.
//   2. Bila port 8321 belum terbuka → jalankan local-server.mjs
//      (jendela "AuroraMaps Server" diperkecil; tutup jendela itu untuk berhenti).
//   3. Bila port 8322 belum terbuka → jalankan sidecar BHUMI (headless).
//   4. Buka Chrome (cadangan: Edge) dengan --app=http://127.0.0.1:8321/
//      → jendela tanpa tab/bilah, seperti hasil "Install app" di Chrome.
//
// Opsi:
//   --kering         hanya cetak rencana + tulis log, jangan menjalankan apa pun
//   --tanpa-sidecar  jangan menyalakan sidecar BHUMI
//
// Log: auroramaps-launcher.log (ditimpa tiap kali dijalankan)
// Kompilasi (dijalankan pasang-auroramaps.bat):
//   csc /nologo /target:winexe /out:AuroraMaps.exe AuroraMaps.cs
// =====================================================
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace AuroraMaps
{
    internal static class Program
    {
        const int PortServer = 8321;
        const int PortSidecar = 8322;
        const string AppUrl = "http://127.0.0.1:8321/";

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool AttachConsole(int dwProcessId);
        const int AttachParentProcess = -1;

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);
        const uint MbIconError = 0x10;

        static string _appDir = "";
        static readonly StringBuilder _log = new StringBuilder();

        static int Main(string[] args)
        {
            // Tanpa konsol bila dobel-klik; bila dipanggil dari CMD, hasil cetak
            // menempel ke konsol induk sehingga mode --kering bisa dibaca.
            AttachConsole(AttachParentProcess);

            bool kering = HasFlag(args, "--kering");
            bool tanpaSidecar = HasFlag(args, "--tanpa-sidecar");
            _appDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? ".";

            Say("AuroraMaps | " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            Say("Folder aplikasi: " + _appDir);

            try
            {
                if (!File.Exists(Path.Combine(_appDir, "local-server.mjs")))
                {
                    return Gagal("Berkas local-server.mjs tidak ditemukan di:\n" + _appDir +
                        "\n\nJalankan kembali pasang-auroramaps.bat untuk memasang ulang.");
                }

                string node = FindNode();
                if (node == null)
                {
                    return Gagal("Node.js belum terpasang di PC ini.\n\nPasang dulu dari https://nodejs.org (versi LTS),\nlalu jalankan kembali AuroraMaps.");
                }
                Say("Node.js: " + node);

                bool serverHidup = IsPortOpen(PortServer);
                string browser = FindBrowser();
                string sidecarPath = Path.Combine(_appDir, "tools", "bhumi-bridge", "sidecar-host.mjs");

                if (kering)
                {
                    Say("[kering] server port " + PortServer + ": " + (serverHidup ? "sudah jalan" : "akan dijalankan"));
                    Say("[kering] node: " + node + " " + Quote(Path.Combine(_appDir, "local-server.mjs")));
                    if (!tanpaSidecar)
                        Say("[kering] sidecar port " + PortSidecar + ": " +
                            (IsPortOpen(PortSidecar) ? "sudah jalan" :
                             (File.Exists(sidecarPath) ? "akan dijalankan" : "berkas tidak ada - dilewati")));
                    Say("[kering] peramban: " + (browser ?? "(tidak ditemukan)"));
                    if (browser != null) Say("[kering] argumen: --app=" + AppUrl);
                    return 0;
                }

                // 1) Server lokal ------------------------------------------------
                if (!serverHidup)
                {
                    Say("Menyalakan server lokal -> " + AppUrl);
                    StartVisible(node, Quote(Path.Combine(_appDir, "local-server.mjs")), "AuroraMaps Server");
                    if (!WaitPort(PortServer, 25000))
                        return Gagal("Server lokal tidak bersedia di port " + PortServer +
                            ".\n\nBuka jendela \"AuroraMaps Server\" di taskbar untuk melihat pesan galatnya.");
                }
                Say("Server lokal siap.");

                // 2) Sidecar BHUMI (opsional) ------------------------------------
                if (!tanpaSidecar && !IsPortOpen(PortSidecar))
                {
                    if (File.Exists(sidecarPath))
                    {
                        Say("Menyalakan sidecar BHUMI (headless)...");
                        StartVisible(node, Quote(sidecarPath), "BHUMI Sidecar");
                        Thread.Sleep(2500);
                    }
                    else
                    {
                        Say("Sidecar tidak ada (" + sidecarPath + ") - dilewati.");
                    }
                }

                // 3) Jendela aplikasi tanpa bilah --------------------------------
                if (browser == null)
                    return Gagal("Google Chrome / Microsoft Edge tidak ditemukan.\n\nAuroraMaps butuh Chrome atau Edge untuk membuka jendela aplikasi.");

                Say("Membuka " + Path.GetFileName(browser) + " dalam mode aplikasi...");
                ProcessStartInfo psi = new ProcessStartInfo();
                psi.FileName = browser;
                psi.Arguments = "--app=" + AppUrl + " --no-first-run --no-default-browser-check";
                psi.UseShellExecute = true;
                psi.WorkingDirectory = _appDir;
                Process.Start(psi);

                Say("Selesai - jendela AuroraMaps terbuka tanpa bilah browser.");
                return 0;
            }
            catch (Exception ex)
            {
                return Gagal("Gagal menjalankan AuroraMaps:\n" + ex.Message);
            }
            finally
            {
                try
                {
                    File.WriteAllText(Path.Combine(_appDir, "auroramaps-launcher.log"), _log.ToString());
                }
                catch { /* log gagal tulis bukanlah kegagalan aplikasi */ }
            }
        }

        // ── Utilitas ────────────────────────────────────────────────────────
        static bool HasFlag(string[] args, string flag)
        {
            foreach (string a in args)
                if (string.Equals(a, flag, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        static string Quote(string path)
        {
            return "\"" + path + "\"";
        }

        static void Say(string text)
        {
            _log.AppendLine(text);
            Console.WriteLine(text);
        }

        static int Gagal(string pesan)
        {
            Say("GAGAL: " + pesan.Replace("\n", " | "));
            MessageBoxW(IntPtr.Zero, pesan, "AuroraMaps", MbIconError);
            return 1;
        }

        // Port terbuka = sudah ada yang mendengarkan (server/sidecar lama dipakai ulang).
        static bool IsPortOpen(int port)
        {
            try
            {
                using (TcpClient c = new TcpClient())
                {
                    IAsyncResult t = c.BeginConnect("127.0.0.1", port, null, null);
                    bool ok = t.AsyncWaitHandle.WaitOne(700, false);
                    if (!ok) return false;
                    c.EndConnect(t);
                    return true;
                }
            }
            catch { return false; }
        }

        static bool WaitPort(int port, int timeoutMs)
        {
            int lewat = 0;
            while (lewat < timeoutMs)
            {
                if (IsPortOpen(port)) return true;
                Thread.Sleep(300);
                lewat += 300;
            }
            return IsPortOpen(port);
        }

        // Jalankan proses konsol dengan jendela DIPERKECIL sehingga tetap terlihat
        // di taskbar (tutup jendela = hentikan prosesnya), bukan disembunyikan.
        static void StartVisible(string exe, string args, string judul)
        {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = exe;
            psi.Arguments = args;
            psi.UseShellExecute = true;
            psi.WorkingDirectory = _appDir;
            psi.WindowStyle = ProcessWindowStyle.Minimized;
            psi.ErrorDialog = false;
            Process.Start(psi);
        }

        static string FindNode()
        {
            List<string> kandidat = new List<string>();
            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string bagian in path.Split(';'))
            {
                string d = bagian.Trim().Trim('"');
                if (d.Length > 0) kandidat.Add(Path.Combine(d, "node.exe"));
            }
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (pf.Length > 0) kandidat.Add(Path.Combine(pf, "nodejs", "node.exe"));
            if (pf86.Length > 0) kandidat.Add(Path.Combine(pf86, "nodejs", "node.exe"));
            if (local.Length > 0) kandidat.Add(Path.Combine(local, "Programs", "nodejs", "node.exe"));

            foreach (string k in kandidat)
            {
                try { if (File.Exists(k)) return k; } catch { /* kandidat tak terbaca - abaikan */ }
            }
            return null;
        }

        static string FindBrowser()
        {
            List<string> kandidat = new List<string>();
            string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            // Chrome dulu (permintaan pengguna), Edge sebagai cadangan.
            if (pf.Length > 0) kandidat.Add(Path.Combine(pf, "Google", "Chrome", "Application", "chrome.exe"));
            if (pf86.Length > 0) kandidat.Add(Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe"));
            if (local.Length > 0) kandidat.Add(Path.Combine(local, "Google", "Chrome", "Application", "chrome.exe"));
            if (pf86.Length > 0) kandidat.Add(Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe"));
            if (pf.Length > 0) kandidat.Add(Path.Combine(pf, "Microsoft", "Edge", "Application", "msedge.exe"));

            string path = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string bagian in path.Split(';'))
            {
                string d = bagian.Trim().Trim('"');
                if (d.Length == 0) continue;
                kandidat.Add(Path.Combine(d, "chrome.exe"));
                kandidat.Add(Path.Combine(d, "msedge.exe"));
            }

            foreach (string k in kandidat)
            {
                try { if (File.Exists(k)) return k; } catch { /* abaikan */ }
            }
            return null;
        }
    }
}