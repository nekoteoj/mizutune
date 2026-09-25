{
  description = "Mizutune Development Environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_26
            (yarn.override { nodejs = nodejs_26; })

            emscripten
            binaryen
            wabt

            cmake
            ninja
            pkg-config
            python3
          ];

          shellHook = ''
            cache_root="''${XDG_CACHE_HOME:-$HOME/.cache}"

            export EM_CACHE="$cache_root/emscripten/${pkgs.emscripten.version}"
            if [ ! -d "$EM_CACHE" ]; then
              mkdir -p "$(dirname "$EM_CACHE")"
              cp -R ${pkgs.emscripten}/share/emscripten/cache "$EM_CACHE"
              chmod -R u+rwX "$EM_CACHE"
            fi
          '';
        };
      });
    };
}
