SystemJS.config({
  nodeConfig: {
    "paths": {
      "app/": "src/"
    }
  },
  devConfig: {
    "map": {
      "plugin-typescript": "github:frankwallis/plugin-typescript@4.0.16"
    }
  },
  transpiler: "plugin-typescript",
  meta: {
    "*.tsx": {
      "loader": "plugin-typescript"
    },
    "*.ts": {
      "loader": "plugin-typescript"
    }
  },
  typescriptOptions: {
    "typeCheck": true,
    "tsconfig": true
  },
  packages: {
    "app": {}
  }
});

SystemJS.config({
  packageConfigPaths: [
    "github:*/*.json",
    "npm:@*/*.json",
    "npm:*.json"
  ],
  map: {
    "os": "github:jspm/nodelibs-os@0.2.0-alpha",
    "process": "github:jspm/nodelibs-process@0.2.0-alpha",
    "react": "npm:react@0.14.7",
    "react-dom": "npm:react-dom@0.14.7",
    "ts": "github:frankwallis/plugin-typescript@4.0.16",
    "typescript": "npm:typescript@1.8.10"
  },
  packages: {
    "npm:react@0.14.7": {
      "map": {
        "fbjs": "npm:fbjs@0.6.1"
      }
    },
    "github:jspm/nodelibs-os@0.2.0-alpha": {
      "map": {
        "os-browserify": "npm:os-browserify@0.2.1"
      }
    },
    "github:frankwallis/plugin-typescript@4.0.16": {
      "map": {
        "typescript": "npm:typescript@1.8.10"
      }
    }
  }
});
