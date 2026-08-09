<!doctype html>
<html lang="en">
<head>
<!--
  NTGOC Draft — the sandbox template.

  Mirrors the live parish template's stylesheet and script order so the chunks
  are tested against the same cascade they will land in: Bootstrap 4.1.3 first,
  the GOARCH template CSS after it, and components.css last so .ntgoc-* rules
  win where they overlap.

  Two deliberate departures from the live template, both required by CLAUDE.md
  rule 4: this carries a robots noindex, and it has no Open Graph tags. The live
  site has OG tags; a draft that could be mistaken for the parish must not.

  Bootstrap, FontAwesome, jQuery, Popper and Google Fonts load from the same
  public CDNs the live template uses, so the sandbox needs internet access to
  look right. It boots and serves without it.
-->
<base href="[(site_url)]">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="robots" content="noindex,nofollow">
<title>[*pagetitle*] | Nativity of the Theotokos Greek Orthodox Church</title>

<link href="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-MCw98/SFnGE8fJT3GXwEOngsV7Zt27NXFoaoApmYm81iuXoPkFOJwJ8ERdknLPMO" crossorigin="anonymous">
<link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.2.0/css/all.css" integrity="sha384-hWVjflwFxL6sNzntih27bfxkr27PmbbK/iSvJ+a4+0owXq79v+lsFkW54bOGbiDQ" crossorigin="anonymous">
<link href="/assets/templates/common/css/template.css" rel="stylesheet">
<link href="/assets/templates/common/css/content.css" rel="stylesheet">
<link href="/assets/templates/t05.css" rel="stylesheet">
<link href="/assets/templates/custom.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css?family=Noto+Sans+TC|Noto+Serif+TC" rel="stylesheet">
<link href="/assets/templates/ntgoc/components.css" rel="stylesheet">
</head>
<body>
{{ntgocDraftBanner}}
{{ntgocTopBar}}
{{ntgocSiteHeader}}
[*content*]
{{ntgocSiteFooter}}
<script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.1.3/js/bootstrap.bundle.min.js"></script>
<script src="/assets/templates/common/js/main.js"></script>
<script src="/assets/templates/ntgoc/ntgoc-enhance.js"></script>
</body>
</html>
