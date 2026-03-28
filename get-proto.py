import urllib.request
url = "https://raw.githubusercontent.com/googleapis/googleapis/master/google/ai/generativelanguage/v1alpha/bidi_service.proto"
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    print(response.read().decode('utf-8'))
