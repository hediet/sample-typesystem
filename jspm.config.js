SystemJS.config({
  packageConfigPaths: [
    "github:*/*.json",
    "npm:@*/*.json",
    "npm:*.json"
  ],
  transpiler: "plugin-typescript",

  meta: {
    "*.tsx": {
      loader: "plugin-typescript"
    },
    "*.ts": {
      loader: "plugin-typescript"
    }
  },
  typescriptOptions: {
    typeCheck: true,
    tsconfig: true
  },
  map: {
    "plugin-typescript": "github:frankwallis/plugin-typescript@4.0.1",
    "process": "github:jspm/nodelibs-process@0.2.0-alpha",
    "react": "npm:react@0.14.7",
    "react-dom": "npm:react-dom@0.14.7"
  },

  packages: {
    "app": {},
    "github:frankwallis/plugin-typescript@4.0.1": {
      "map": {
        "typescript": "npm:typescript@1.8.2"
      }
    },
    "npm:react@0.14.7": {
      "map": {
        "fbjs": "npm:fbjs@0.6.1"
      }
    }
  }
});
