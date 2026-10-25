//! Looks: redraw a library piece in another set of characters.

/// The looks every piece can be redrawn in, as in `runtime/glyphs.js`.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub enum LookName {
    #[default]
    Original,
    Dots,
    Ascii,
    Dense,
    Numbers,
    Binary,
    Letters,
    Blocks,
    Squares,
    Lines,
    Dither,
}

impl LookName {
    /// Every look, in the order the CLI cycles through them.
    pub const ALL: [LookName; 11] = [
        LookName::Original,
        LookName::Dots,
        LookName::Ascii,
        LookName::Dense,
        LookName::Numbers,
        LookName::Binary,
        LookName::Letters,
        LookName::Blocks,
        LookName::Squares,
        LookName::Lines,
        LookName::Dither,
    ];

    /// The name the JS runtime uses (`"dots"`, `"ascii"`...).
    pub fn as_str(self) -> &'static str {
        match self {
            LookName::Original => "original",
            LookName::Dots => "dots",
            LookName::Ascii => "ascii",
            LookName::Dense => "dense",
            LookName::Numbers => "numbers",
            LookName::Binary => "binary",
            LookName::Letters => "letters",
            LookName::Blocks => "blocks",
            LookName::Squares => "squares",
            LookName::Lines => "lines",
            LookName::Dither => "dither",
        }
    }

    /// The next look, wrapping around. Handy for an "s" key that cycles looks.
    pub fn next(self) -> LookName {
        let i = LookName::ALL.iter().position(|&l| l == self).unwrap_or(0);
        LookName::ALL[(i + 1) % LookName::ALL.len()]
    }
}

/// A look plus its settings. Same options as the `<ascii-art>` attributes.
/// Looks apply to library pieces; native pieces draw as they are.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Look {
    pub look: LookName,
    /// Your own characters instead of a look, e.g. `" .oO@"` (sorted light to dark for you).
    pub chars: Option<String>,
    /// One colour (the default ink) instead of the palette.
    pub mono: bool,
    /// Redraw text and line work too, not only shading.
    pub all: bool,
    /// 0 to 100, default 0.
    pub contrast: Option<f64>,
    /// Halftone dot size for the dots look, 25 to 120, default 51.
    pub dot_size: Option<f64>,
    /// Halftone dot spacing, 40 to 250, default 131.
    pub density: Option<f64>,
    /// Halftone dot sizes: 3, 5, or 0 for smooth.
    pub steps: Option<u8>,
}

impl From<LookName> for Look {
    fn from(look: LookName) -> Look {
        Look {
            look,
            ..Look::default()
        }
    }
}

impl Look {
    /// Your own characters, light to dark.
    pub fn chars(chars: impl Into<String>) -> Look {
        Look {
            chars: Some(chars.into()),
            ..Look::default()
        }
    }

    pub fn mono(mut self, on: bool) -> Self {
        self.mono = on;
        self
    }

    pub fn all(mut self, on: bool) -> Self {
        self.all = on;
        self
    }

    pub fn contrast(mut self, v: f64) -> Self {
        self.contrast = Some(v);
        self
    }

    /// True when the piece draws as it is.
    pub fn is_original(&self) -> bool {
        self.look == LookName::Original && self.chars.is_none() && !self.mono
    }

    /// The runtime's look options as JSON, with the same mapping as `runtime/ascii.js`.
    pub(crate) fn to_json(&self) -> String {
        if self.is_original() {
            return String::new();
        }
        let mut o = serde_json::Map::new();
        if self.look != LookName::Original {
            o.insert("look".into(), self.look.as_str().into());
        }
        if let Some(c) = &self.chars {
            o.insert("chars".into(), c.as_str().into());
        }
        if self.mono {
            o.insert("mono".into(), true.into());
        }
        if self.all {
            o.insert("all".into(), true.into());
        }
        if let Some(c) = self.contrast {
            o.insert("gamma".into(), (0.35 + c / 100.0 * 0.8).into());
        }
        if let Some(v) = self.dot_size {
            o.insert("size".into(), (v / 100.0).into());
        }
        if let Some(v) = self.density {
            o.insert("density".into(), (v / 100.0).into());
        }
        if let Some(v) = self.steps {
            o.insert("steps".into(), v.into());
        }
        serde_json::Value::Object(o).to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_mapping() {
        assert_eq!(Look::default().to_json(), "");
        assert_eq!(Look::from(LookName::Dots).to_json(), r#"{"look":"dots"}"#);
        let l = Look {
            contrast: Some(50.0),
            steps: Some(5),
            ..Look::from(LookName::Dots)
        };
        assert_eq!(l.to_json(), r#"{"gamma":0.75,"look":"dots","steps":5}"#);
        assert_eq!(LookName::Dither.next(), LookName::Original);
    }
}
