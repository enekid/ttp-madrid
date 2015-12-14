'use strict';

var myArgs = process.argv.slice(2),
    Q = require('q');

function requestSoapCardInfoXml(cardNumber) {
    var deferred = Q.defer(),
        soap = require('soap'),
        url  = 'http://www.citram.es:50081/VENTAPREPAGOTITULO/VentaPrepagoTitulo.svc?wsdl';

    soap.createClient(url, function (err, client) {
        if (err) {
            deferred.reject(err);
        }
        var args = {
            sNumeroTP: cardNumber,
            sLenguaje: "es",
            sTipoApp: "APP_SALDO_ANDROID"
        };

        client.ConsultaSaldoTarjeta1(args, function (err, result) {
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(result.ConsultaSaldoTarjeta1Result.sResulXMLField);
            }
        });
    });

    return deferred.promise;
}

function getLocalCardInfoXml(cardNumber) {
    var deferred = Q.defer(),
        fs = require('fs');

    fs.readFile('xml/' + cardNumber + '.soap.response.xml', 'utf8', function (err, data) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(data);
        }
    });

    return deferred.promise;
}

function requestHttpCardInfoXml(cardNumber) {
    var deferred = Q.defer(),
        http = require('http');

    http.get('http://localhost:8888/xml/' + cardNumber + '.soap.response.xml', function (res) {
        res.on('data', function (data) {
            deferred.resolve(data);
        });
    });

    return deferred.promise;
}

function getCliXmlProviderId() {
    if (!myArgs.length) {
        return 'h';
    }
    return myArgs[0];
}

function getCliCardId() {
    if (myArgs.length < 2) {
        return "0010010287871";
    }
    return myArgs[1];
}

function getCardInfoXml() {
    var deferred = Q.defer(),
        xmlProvider;

    switch ('s') {
    case 's':
        xmlProvider = requestSoapCardInfoXml;
        break;
    case 'f':
        xmlProvider = getLocalCardInfoXml;
        break;
    case 'h':
        xmlProvider = requestHttpCardInfoXml;
        break;
    }

    xmlProvider(getCliCardId())
        .then(function (xml) {
            deferred.resolve(xml);
        })
        .catch(function (err) {
            deferred.reject(err);
        });

    return deferred.promise;
}

function extractCardInfo(data) {
    var deferred = Q.defer(),
        cardInfo = [];

    try {
        data['consulta-saldo'].titulos.forEach(function (tituloWrapper) {
            var cardInfoItem = {},
                titulo = tituloWrapper.titulo[0],
                dataSection = titulo.data,
                cargaSection = titulo.carga[0].data;

            dataSection.forEach(function (item) {
                switch (item.$.name) {
                case 'ContractName':
                    cardInfoItem.titleName = item.$.value;
                    break;
                case 'ContractUserProfileTypeName':
                    cardInfoItem.type = item.$.value;
                    break;
                }
            });

            cardInfoItem.charge = {};
            cargaSection.forEach(function (item) {
                switch (item.$.name) {
                case 'ContractChargeDate':
                    cardInfoItem.charge.chargeDate = item.$.value;
                    break;
                case 'ContractChargeStartDate':
                    cardInfoItem.charge.validStartDate = item.$.value;
                    break;
                case 'ContractChargeEndDate':
                    cardInfoItem.charge.validEndDate = item.$.value;
                    break;
                case 'ChargeFirstUseDate':
                    cardInfoItem.charge.lastDateForFirstAccess = item.$.value;
                    break;
                case 'AccessEventInFirstPayDateCe':
                    cardInfoItem.charge.firstAccessDate = item.$.value;
                    break;
                case 'ChargeEndDate':
                    cardInfoItem.charge.expireDate = item.$.value;
                    break;
                }
            });

            cardInfo.push(cardInfoItem);
        });
    } catch (e) {
        throw new Error('Error parsing XML');
    }

    return cardInfo;
}

var parseXml = function (xmlToParse) {

    var deferred = Q.defer(),
        parseString = require('xml2js').parseString;

    parseString(xmlToParse, function (err, parsed) {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(parsed);
        }

        // console.log(parsed['consulta-saldo'].titulos[0].titulo[0].data[1].$.value);
        // console.log(parsed['consulta-saldo'].titulos[0].titulo[0].carga[0].data[1].$.value);
        // console.log(parsed['consulta-saldo'].titulos[0].titulo[0].carga[0].data[5].$.value);
    });

    return deferred.promise;
};

function getCardInfo() {
    Q.fcall(getCardInfoXml)
        .then(parseXml)
        .then(function (parsed) {
            var cardInfo = extractCardInfo(parsed);
            console.log(cardInfo);
            // cardInfo.forEach(function (cardInfoItem) {
            //     console.log(cardInfoItem);
            // });
        })
        .catch(function (err) {
            console.log('::::ERROR:::: ' + err);
        });
}

getCardInfo("0010010287871");
//var cardInfo = getCardInfo();