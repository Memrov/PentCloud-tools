# Third-party notices

The original PentCloud adapter source and type declarations in this npm SDK are MIT licensed. The tarball includes pin metadata, but no third-party tool executables, source archives, datasets or container images.

- Metasploit Framework core: [BSD-3-Clause](https://github.com/rapid7/metasploit-framework/blob/master/LICENSE), with third-party component exceptions listed in that file.
- The pinned vendor image includes Nmap and other separately licensed components. Its digest in `tools.lock.json` identifies the upstream image; the adapter license does not license that image or its contents.

Upstream programs, data and image dependencies retain their own licenses and notices. Image builders preserve those notices. Building or distributing a separate image requires compliance with its components' terms; this adapter SDK grants no additional rights to them. Image-specific cautions in `tools.lock.json` remain in effect.
